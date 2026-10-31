import express from 'express';
import fetch from 'node-fetch';
import net from 'net';
import { safeQuery } from '../db.js';
import { logger } from '../utils/logger.js';

export const llmProxyRouter = express.Router();

/**
 * Checks if an IP address belongs to RFC 1918 private ranges, link-local, or cloud metadata.
 * @param {string} ip
 * @returns {boolean}
 */
export function isPrivateOrReservedIp(ip) {
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    // 0.0.0.0/8
    if (parts[0] === 0) return true;
    // 10.0.0.0/8 (RFC 1918)
    if (parts[0] === 10) return true;
    // 100.64.0.0/10 (Shared Address Space)
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;
    // 169.254.0.0/16 (Link-local / Cloud metadata RFC 3927)
    if (parts[0] === 169 && parts[1] === 254) return true;
    // 172.16.0.0/12 (RFC 1918)
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    // 192.168.0.0/16 (RFC 1918)
    if (parts[0] === 192 && parts[1] === 168) return true;
    // Multicast & Reserved
    if (parts[0] >= 224) return true;
    return false;
  }
  if (net.isIPv6(ip)) {
    const normalized = ip.toLowerCase();
    // IPv6 link-local fe80::/10
    if (normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) return true;
    // IPv6 unique local fc00::/7 (RFC 4193)
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
    return false;
  }
  return false;
}

/**
 * Validates upstream target URL against SSRF attacks (RFC1918, link-local, metadata).
 * @param {string} urlStr
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateTargetUrl(urlStr) {
  let parsed;
  try {
    parsed = new URL(urlStr);
  } catch {
    return { valid: false, error: 'Nieprawidłowy adres URL' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { valid: false, error: 'Dozwolone są wyłącznie protokoły HTTP i HTTPS' };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Cloud metadata endpoints
  if (
    hostname === '169.254.169.254' ||
    hostname === 'metadata.google.internal' ||
    hostname === 'instance-data'
  ) {
    return { valid: false, error: 'Dostęp do endpointów metadanych chmury jest zabroniony' };
  }

  if (isPrivateOrReservedIp(hostname)) {
    return { valid: false, error: 'Dostęp do prywatnych adresów sieciowych (RFC1918 / link-local) jest zablokowany' };
  }

  return { valid: true };
}

/**
 * Resolves upstream LLM URL from headers or dashboard settings.
 */
async function resolveUpstreamBaseUrl(req) {
  if (req.headers['x-target-url']) {
    const rawUrl = String(req.headers['x-target-url']).trim().replace(/\/+$/, '');
    const validation = validateTargetUrl(rawUrl);
    if (!validation.valid) {
      const err = new Error(validation.error);
      err.status = 403;
      throw err;
    }
    return rawUrl;
  }
  try {
    const res = await safeQuery("SELECT value FROM settings WHERE key = 'llmUrl'");
    if (res?.rows?.[0]?.value) {
      return res.rows[0].value.trim().replace(/\/+$/, '');
    }
  } catch (err) {
    logger.warn({ err: err.message }, 'Failed to query llmUrl from settings for proxy');
  }
  return (process.env.LLM_LOCAL_URL || 'http://127.0.0.1:1234/v1').replace(/\/+$/, '');
}

/**
 * Persists token usage in agent_tasks.
 */
async function recordTokenUsage({ totalTokens, promptTokens, completionTokens, taskId }) {
  if (!totalTokens || totalTokens <= 0) return;
  try {
    if (taskId) {
      await safeQuery(
        `UPDATE agent_tasks
         SET tokens_used = tokens_used + $1,
             prompt_tokens = prompt_tokens + $2,
             completion_tokens = completion_tokens + $3,
             updated_at = NOW()
         WHERE id = $4`,
        [totalTokens, promptTokens || 0, completionTokens || 0, taskId]
      );
    } else {
      // Attribute to the most recently created active or completed task
      await safeQuery(
        `UPDATE agent_tasks
         SET tokens_used = tokens_used + $1,
             prompt_tokens = prompt_tokens + $2,
             completion_tokens = completion_tokens + $3,
             updated_at = NOW()
         WHERE id = (
           SELECT id FROM agent_tasks ORDER BY id DESC LIMIT 1
         )`,
        [totalTokens, promptTokens || 0, completionTokens || 0]
      );
    }
  } catch (err) {
    logger.warn({ err: err.message }, 'Failed to record token usage in agent_tasks');
  }
}

/**
 * Catch-all proxy handler for OpenAI and Anthropic format completions.
 */
llmProxyRouter.use(async (req, res) => {
  let upstreamBase;
  try {
    upstreamBase = await resolveUpstreamBaseUrl(req);
  } catch (urlErr) {
    return res.status(urlErr.status || 400).json({
      error: `SSRF Blocked: ${urlErr.message}`
    });
  }

  const subPath = req.url.startsWith('/') ? req.url : `/${req.url}`;
  const targetUrl = `${upstreamBase}${subPath}`;

  const forwardHeaders = { ...req.headers };
  delete forwardHeaders.host;
  delete forwardHeaders['content-length'];

  const taskIdHeader = req.headers['x-task-id'] ? parseInt(req.headers['x-task-id'], 10) : null;

  try {
    const options = {
      method: req.method,
      headers: forwardHeaders,
    };

    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      options.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    }

    const upstreamResponse = await fetch(targetUrl, options);

    // Forward status and headers
    res.status(upstreamResponse.status);
    for (const [key, val] of upstreamResponse.headers.entries()) {
      if (key.toLowerCase() !== 'transfer-encoding') {
        res.setHeader(key, val);
      }
    }

    const contentType = upstreamResponse.headers.get('content-type') || '';

    // Handle streaming Server-Sent Events (SSE)
    if (contentType.includes('text/event-stream')) {
      let accumulatedTokens = 0;
      try {
        if (upstreamResponse.body) {
          for await (const chunk of upstreamResponse.body) {
            res.write(chunk);
            const str = typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString();
            // Look for OpenAI usage or Anthropic message_delta usage in chunks
            const match = str.match(/"total_tokens"\s*:\s*(\d+)/) || str.match(/"output_tokens"\s*:\s*(\d+)/);
            if (match && match[1]) {
              accumulatedTokens = parseInt(match[1], 10);
            }
          }
        }
      } catch (streamErr) {
        logger.warn({ err: streamErr.message }, 'LLM Proxy stream error');
      } finally {
        res.end();
        if (accumulatedTokens > 0) {
          recordTokenUsage({ totalTokens: accumulatedTokens, taskId: taskIdHeader });
        }
      }
      return;
    }

    // Handle standard JSON response
    const rawBody = await upstreamResponse.text();
    try {
      const data = JSON.parse(rawBody);
      let total = 0;
      let prompt = 0;
      let completion = 0;

      // Handle both OpenAI and Anthropic usage formats
      if (data?.usage) {
        prompt = data.usage.input_tokens ?? data.usage.prompt_tokens ?? 0;
        completion = data.usage.output_tokens ?? data.usage.completion_tokens ?? 0;
        total = data.usage.total_tokens ?? (prompt + completion);
      }

      if (total > 0) {
        await recordTokenUsage({
          totalTokens: total,
          promptTokens: prompt,
          completionTokens: completion,
          taskId: taskIdHeader,
        });
      }

      if (upstreamResponse.status >= 400) {
        const errorMsg = data?.error?.message || data?.error || `LLM upstream status ${upstreamResponse.status}`;
        safeQuery(
          'INSERT INTO agent_logs (task_id, level, message) VALUES ($1, $2, $3)',
          [taskIdHeader, 'error', String(errorMsg)]
        ).catch(() => {});
      }
    } catch {
      // Non-JSON response, pass through as text
    }

    return res.send(rawBody);
  } catch (err) {
    logger.error({ err: err.message, targetUrl }, 'LLM Proxy connection failure');
    return res.status(502).json({
      error: `LLM Proxy failed to reach upstream at ${targetUrl}: ${err.message}`,
    });
  }
});
