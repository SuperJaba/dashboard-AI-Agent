import { randomUUID } from 'crypto';

/**
 * T3.1 — Webhook Subscription Store.
 * In-memory primary store; PostgreSQL support can be layered on later via safeQuery.
 *
 * Schema: { id, url, events: string[], secret, active, createdAt }
 * Supported events: 'agent:completed' | 'alert:triggered' | 'deploy:finished' | 'ping'
 */

/** @type {Map<string, object>} */
const store = new Map();

/**
 * Create a new webhook subscription.
 * @param {{ url: string, events: string[], secret?: string, active?: boolean }} data
 * @returns {object}
 */
export function create(data) {
  const webhook = {
    id: randomUUID(),
    url: data.url,
    events: data.events,
    secret: data.secret ?? '',
    active: data.active ?? true,
    createdAt: new Date().toISOString(),
  };
  store.set(webhook.id, webhook);
  return webhook;
}

/**
 * Return all webhooks.
 * @returns {object[]}
 */
export function findAll() {
  return Array.from(store.values());
}

/**
 * Find a webhook by id.
 * @param {string} id
 * @returns {object|null}
 */
export function findById(id) {
  return store.get(id) ?? null;
}

/**
 * Update an existing webhook.
 * @param {string} id
 * @param {Partial<{url: string, events: string[], secret: string, active: boolean}>} data
 * @returns {object|null}
 */
export function update(id, data) {
  const existing = store.get(id);
  if (!existing) { return null; }
  const updated = { ...existing, ...data };
  store.set(id, updated);
  return updated;
}

/**
 * Remove a webhook by id.
 * @param {string} id
 * @returns {boolean}
 */
export function remove(id) {
  return store.delete(id);
}

/**
 * Clear all webhooks (used in tests).
 */
export function _clearAll() {
  store.clear();
}
