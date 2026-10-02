import fetch from 'node-fetch';
import { findAll } from './webhookRepository.js';
import { signPayload } from './signature.js';
import { logger } from '../utils/logger.js';

const TIMEOUT_MS = 5000;
const RETRY_DELAYS_MS = [1000, 2000, 4000];

/**
 * Attempt a single POST to a webhook URL with HMAC-SHA256 signature.
 * @param {string} url
 * @param {string} secret
 * @param {string} event
 * @param {object} payload
 * @param {number} attempt - 0-based attempt index for logging
 * @returns {Promise<void>} Throws on failure.
 */
async function attemptDelivery(url, secret, event, payload, attempt) {
  const body = JSON.stringify({ event, payload, deliveredAt: new Date().toISOString() });
  const signature = secret ? `sha256=${signPayload(secret, body)}` : '';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(signature ? { 'X-Dashboard-Signature-256': signature } : {}),
        'X-Dashboard-Event': event,
      },
      body,
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    logger.info({ url, event, attempt }, 'Webhook delivered successfully');
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Deliver an event to a single webhook with retry backoff.
 * @param {object} webhook
 * @param {string} event
 * @param {object} payload
 */
async function deliverWithRetry(webhook, event, payload) {
  const { id, url, secret } = webhook;

  for (let attempt = 0; attempt < RETRY_DELAYS_MS.length + 1; attempt++) {
    try {
      await attemptDelivery(url, secret, event, payload, attempt);
      return;
    } catch (err) {
      const isLast = attempt >= RETRY_DELAYS_MS.length;
      if (isLast) {
        logger.error({ id, url, event, attempt, err: err.message }, 'Webhook delivery failed after all retries');
        return;
      }
      const delay = RETRY_DELAYS_MS[attempt];
      logger.warn({ id, url, event, attempt, delay, err: err.message }, 'Webhook delivery failed, retrying');
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

/**
 * T3.2 — Fire-and-forget outbound dispatcher.
 * Sends the event to every active webhook subscribing to it.
 * Does NOT block the caller.
 *
 * @param {string} event
 * @param {object} [payload]
 */
export function dispatchWebhook(event, payload = {}) {
  const targets = findAll().filter(
    (wh) => wh.active && (wh.events.includes(event) || wh.events.includes('*'))
  );

  if (targets.length === 0) { return; }

  // Fire-and-forget — errors are caught inside deliverWithRetry
  for (const webhook of targets) {
    deliverWithRetry(webhook, event, payload).catch((err) => {
      logger.error({ webhookId: webhook.id, event, err: err.message }, 'Unexpected dispatcher error');
    });
  }
}
