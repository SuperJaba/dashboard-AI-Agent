import express from 'express';
import fs from 'fs';
import { execSync } from 'child_process';
import * as agentsRepo from './agentsRepository.js';
import * as settingsRepo from '../settings/settingsRepository.js';
import { getBestAvailableModel } from '../utils/llm.js';

export const agentsRouter = express.Router();

// Canonical catalog of well-known CLI coding agents we know how to auto-detect.
// Extend this list (rather than hardcoding one-off entries) whenever a new
// agent CLI should be discoverable by the "System scan" feature.
const KNOWN_AGENTS = [
  { name: 'Claude Code', cmd: 'claude', desc: 'Anthropic Claude Code CLI', configPath: (home) => `${home}/.claude.json` },
  { name: 'Codex', cmd: 'codex', desc: 'OpenAI Codex CLI', configPath: (home) => `${home}/.codex/config.json` },
  { name: 'Antigravity', cmd: 'agy', desc: 'Google AI Antigravity CLI', configPath: (home) => `${home}/.gemini/config.json` },
  { name: 'Aider', cmd: 'aider', desc: 'Aider AI pair programming', configPath: (home) => `${home}/.aider.conf.yml` },
  { name: 'Gemini CLI', cmd: 'gemini', desc: 'Google Gemini CLI', configPath: (home) => `${home}/.gemini/config.json` },
  { name: 'OpenCode', cmd: 'opencode', desc: 'OpenCode AI coding agent CLI', configPath: (home) => `${home}/.opencode/config.json` },
  { name: 'GitHub Copilot CLI', cmd: 'copilot', desc: 'GitHub Copilot CLI', configPath: () => '' },
  { name: 'Cursor Agent', cmd: 'cursor-agent', desc: 'Cursor CLI agent', configPath: () => '' }
];

/**
 * Resolves the absolute path of a CLI executable on PATH, cross-platform.
 * Uses `where` on Windows and `which` everywhere else (avoids relying on a
 * Unix-only tool that silently fails as ENOENT on Windows).
 */
export function findInPath(cmd) {
  try {
    const command = process.platform === 'win32' ? `where.exe ${cmd}` : `which ${cmd}`;
    const stdout = execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (!stdout) {return null;}
    const lines = stdout.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) {return null;}

    if (process.platform === 'win32') {
      const cwdLower = process.cwd().toLowerCase();
      // 1. Prefer .exe, .cmd, .bat outside current working directory
      const preferred = lines.find(l => {
        const lower = l.toLowerCase();
        return (lower.endsWith('.exe') || lower.endsWith('.cmd') || lower.endsWith('.bat')) && !lower.startsWith(cwdLower);
      }) || lines.find(l => {
        const lower = l.toLowerCase();
        return lower.endsWith('.exe') || lower.endsWith('.cmd') || lower.endsWith('.bat');
      }) || lines[0];

      return preferred;
    }

    return lines[0];
  } catch {
    return null;
  }
}

// Get agents
agentsRouter.get('/', async (req, res) => {
  try {
    const agents = await agentsRepo.getAgents();
    res.json(agents);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Scan agents
agentsRouter.post('/scan', async (req, res) => {
  try {
    const home = process.env.HOME || process.env.USERPROFILE;
    const found = [];

    for (const agent of KNOWN_AGENTS) {
      const resolvedPath = findInPath(agent.cmd);
      const existing = await agentsRepo.findAgentByName(agent.name);

      if (resolvedPath) {
        let configUri = agent.configPath(home) || '';
        if (configUri && !fs.existsSync(configUri)) {
          configUri = '';
        }

        if (!existing) {
          await agentsRepo.createAgent({
            name: agent.name,
            description: agent.desc,
            path: resolvedPath,
            config_uri: configUri
          });
        } else {
          // Update if empty, otherwise preserve user's custom config_uri
          await agentsRepo.updateAgentPathAndConfig(agent.name, resolvedPath, configUri);
        }
        found.push(agent.name);
      } else if (existing && existing.installed) {
        // Previously discovered but no longer resolvable (uninstalled, PATH
        // changed, etc.) — mark as not installed so nothing tries to spawn it.
        await agentsRepo.setAgentInstalled(existing.id, false);
      }
    }

    // Also flag any other stored agent whose path no longer exists on disk
    // (e.g. stale/manually-entered entries), so the background worker skips them.
    const allAgents = await agentsRepo.getAgents();
    for (const agent of allAgents) {
      if (agent.installed && agent.path && !fs.existsSync(agent.path) && !found.includes(agent.name)) {
        await agentsRepo.setAgentInstalled(agent.id, false);
      }
    }

    res.json({ success: true, found });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update agent
agentsRouter.put('/:id', async (req, res) => {
  try {
    const row = await agentsRepo.updateAgent(req.params.id, req.body);
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save agent
agentsRouter.post('/', async (req, res) => {
  const { name, description, path: binPath, config_uri, llm_model, temperature, max_tokens } = req.body;
  try {
    const row = await agentsRepo.createAgent({
      name,
      description,
      path: binPath,
      config_uri,
      llm_model,
      temperature,
      max_tokens
    });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete agent
agentsRouter.delete('/:id', async (req, res) => {
  try {
    const result = await agentsRepo.deleteAgent(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Auto-tune an agent's configuration (temp, max_tokens, best model choice)
agentsRouter.post('/:id/tune', async (req, res) => {
  const { id } = req.params;
  try {
    const agent = await agentsRepo.getAgentById(id);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    // Try to get LLM config from settings
    const { llmUrl, apiKey } = await settingsRepo.getLlmCredentials();

    const tuned = {
      temperature: 0.7,
      max_tokens: 4096,
      llm_model: agent.llm_model || 'gpt-4o'
    };

    if (llmUrl && apiKey) {
      const url = llmUrl.endsWith('/chat/completions') ? llmUrl : (llmUrl.endsWith('/') ? llmUrl.slice(0, -1) : llmUrl) + '/chat/completions';
      try {
        const activeModel = await getBestAvailableModel(llmUrl, apiKey);
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: activeModel,
            messages: [{
              role: 'user',
              content: `Optimize parameters for AI Agent. Name: "${agent.name}", Description: "${agent.description || ''}".
              Return JSON ONLY with keys: "temperature" (float 0.0-1.0), "max_tokens" (integer 1000-16000), "llm_model" (string, choose best matching model, e.g. claude-3-5-sonnet, gpt-4o, deepseek-coder, or keep current "${agent.llm_model || 'gpt-4o'}"). Do not explain.`
            }],
            temperature: 0.2
          })
        });
        if (response.ok) {
          const data = await response.json();
          const content = data?.choices?.[0]?.message?.content || '';
          const match = content.match(/\{.*\}/s);
          if (match) {
            const parsed = JSON.parse(match[0]);
            if (parsed.temperature !== undefined) {tuned.temperature = parseFloat(parsed.temperature);}
            if (parsed.max_tokens !== undefined) {tuned.max_tokens = parseInt(parsed.max_tokens);}
            if (parsed.llm_model !== undefined) {tuned.llm_model = parsed.llm_model;}
          }
        }
      } catch (e) {
        console.error('LLM Tuning request failed, falling back to heuristics:', e.message);
      }
    }

    // Heuristics fallback if LLM tuning failed or wasn't configured
    if (!llmUrl || !apiKey) {
      const nameLower = agent.name.toLowerCase();
      if (nameLower.includes('r1') || nameLower.includes('reason')) {
        // Reasoning models require 0.5-0.7 temperature to prevent repetitiveness in thought chains
        tuned.temperature = 0.6;
        tuned.max_tokens = 16384;
        tuned.llm_model = 'deepseek-reasoner';
      } else if (nameLower.includes('review') || nameLower.includes('security') || nameLower.includes('audit')) {
        // Strict precision/syntax requires low temperature (0.1)
        tuned.temperature = 0.1;
        tuned.max_tokens = 8192;
      } else if (nameLower.includes('creative') || nameLower.includes('writer') || nameLower.includes('chat')) {
        tuned.temperature = 0.9;
        tuned.max_tokens = 4096;
      } else if (nameLower.includes('coder') || nameLower.includes('architect') || nameLower.includes('aider') || nameLower.includes('claude')) {
        tuned.temperature = 0.2;
        tuned.max_tokens = 8192;
        tuned.llm_model = 'claude-3-5-sonnet';
      }
    }

    const updated = await agentsRepo.updateAgentTunedParams(id, tuned);

    // 2. Run verification test against the LLM Server (using the tuned parameters)
    let testStatus = 'untested';
    let testError = null;
    const targetUrl = llmUrl || 'http://localhost:1337/v1';
    const testModel = tuned.llm_model || agent.llm_model || 'gpt-4o';

    try {
      const base = targetUrl.endsWith('/chat/completions') 
        ? targetUrl.replace('/chat/completions', '') 
        : (targetUrl.endsWith('/') ? targetUrl.slice(0, -1) : targetUrl);

      const checkUrl = `${base}/v1/chat/completions`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const testResponse = await fetch(checkUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {})
        },
        body: JSON.stringify({
          model: testModel,
          messages: [{ role: 'user', content: 'Test connection. Reply with OK.' }],
          temperature: tuned.temperature,
          max_tokens: 5,
          ctx_len: tuned.max_tokens
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (testResponse.ok) {
        testStatus = 'passed';
      } else {
        testStatus = 'failed';
        testError = `HTTP ${testResponse.status}`;
      }
    } catch (e) {
      testStatus = 'failed';
      testError = e.message;
    }

    res.json({ 
      success: true, 
      agent: updated, 
      tunedByLLM: !!(llmUrl && apiKey),
      testStatus,
      testError
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
