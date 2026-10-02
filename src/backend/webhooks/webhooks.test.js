import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as repo from './webhookRepository.js';
import { signPayload, verifySignature } from './signature.js';
import { dispatchWebhook } from './webhookDispatcher.js';

// ---------------------------------------------------------------------------
// Mock node-fetch so we can test dispatch without real HTTP calls
// ---------------------------------------------------------------------------
vi.mock('node-fetch', () => ({
  default: vi.fn(),
}));

import fetch from 'node-fetch';

beforeEach(() => {
  repo._clearAll();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// T3.1 — Repository CRUD
// ---------------------------------------------------------------------------
describe('webhookRepository', () => {
  it('creates a webhook with a generated id and createdAt', () => {
    const wh = repo.create({ url: 'https://example.com/hook', events: ['ping'] });
    expect(wh.id).toBeTruthy();
    expect(wh.url).toBe('https://example.com/hook');
    expect(wh.events).toEqual(['ping']);
    expect(wh.active).toBe(true);
    expect(wh.createdAt).toBeTruthy();
  });

  it('findAll returns all created webhooks', () => {
    repo.create({ url: 'https://a.com', events: ['ping'] });
    repo.create({ url: 'https://b.com', events: ['agent:completed'] });
    expect(repo.findAll()).toHaveLength(2);
  });

  it('findById returns the correct webhook or null', () => {
    const wh = repo.create({ url: 'https://c.com', events: ['ping'] });
    expect(repo.findById(wh.id)).toEqual(wh);
    expect(repo.findById('nonexistent')).toBeNull();
  });

  it('update patches fields on an existing webhook', () => {
    const wh = repo.create({ url: 'https://d.com', events: ['ping'] });
    const updated = repo.update(wh.id, { active: false, url: 'https://d2.com' });
    expect(updated?.active).toBe(false);
    expect(updated?.url).toBe('https://d2.com');
    expect(updated?.events).toEqual(['ping']); // unchanged
  });

  it('update returns null for unknown id', () => {
    expect(repo.update('ghost', { active: false })).toBeNull();
  });

  it('remove deletes the webhook and returns true', () => {
    const wh = repo.create({ url: 'https://e.com', events: ['ping'] });
    expect(repo.remove(wh.id)).toBe(true);
    expect(repo.findAll()).toHaveLength(0);
  });

  it('remove returns false for unknown id', () => {
    expect(repo.remove('ghost')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// T3.3 — HMAC-SHA256 Signing
// ---------------------------------------------------------------------------
describe('signature', () => {
  const secret = 'super-secret';
  const body = JSON.stringify({ event: 'ping', payload: {} });

  it('signPayload returns a non-empty hex string', () => {
    const sig = signPayload(secret, body);
    expect(sig).toMatch(/^[a-f0-9]{64}$/);
  });

  it('verifySignature accepts a matching raw hex signature', () => {
    const sig = signPayload(secret, body);
    expect(verifySignature(secret, body, sig)).toBe(true);
  });

  it('verifySignature accepts sha256= prefixed signature', () => {
    const sig = signPayload(secret, body);
    expect(verifySignature(secret, body, `sha256=${sig}`)).toBe(true);
  });

  it('verifySignature rejects a tampered body', () => {
    const sig = signPayload(secret, body);
    expect(verifySignature(secret, '{"tampered":true}', sig)).toBe(false);
  });

  it('verifySignature rejects a wrong secret', () => {
    const sig = signPayload('wrong-secret', body);
    expect(verifySignature(secret, body, sig)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// T3.2 — Dispatcher (mocked fetch)
// ---------------------------------------------------------------------------
describe('dispatchWebhook', () => {
  it('does not call fetch when no active webhooks exist', () => {
    dispatchWebhook('ping', {});
    expect(fetch).not.toHaveBeenCalled();
  });

  it('calls fetch for each active webhook subscribing to the event', async () => {
    fetch.mockResolvedValue({ ok: true });

    repo.create({ url: 'https://hook1.com', events: ['ping'], active: true });
    repo.create({ url: 'https://hook2.com', events: ['agent:completed'], active: true });

    dispatchWebhook('ping', { data: 'test' });

    // Allow async microtasks to run
    await new Promise((r) => setTimeout(r, 50));

    // Only hook1 subscribed to 'ping'
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe('https://hook1.com');
  });

  it('does not dispatch to inactive webhooks', async () => {
    fetch.mockResolvedValue({ ok: true });

    repo.create({ url: 'https://inactive.com', events: ['ping'], active: false });
    dispatchWebhook('ping', {});

    await new Promise((r) => setTimeout(r, 50));
    expect(fetch).not.toHaveBeenCalled();
  });

  it('includes X-Dashboard-Signature-256 header when secret is set', async () => {
    fetch.mockResolvedValue({ ok: true });

    repo.create({ url: 'https://signed.com', events: ['ping'], secret: 'mysecret', active: true });
    dispatchWebhook('ping', {});

    await new Promise((r) => setTimeout(r, 50));

    const callArgs = fetch.mock.calls[0];
    const headers = callArgs[1]?.headers ?? {};
    expect(headers['X-Dashboard-Signature-256']).toMatch(/^sha256=[a-f0-9]{64}$/);
  });

  it('omits signature header when no secret is set', async () => {
    fetch.mockResolvedValue({ ok: true });

    repo.create({ url: 'https://nosig.com', events: ['ping'], secret: '', active: true });
    dispatchWebhook('ping', {});

    await new Promise((r) => setTimeout(r, 50));

    const callArgs = fetch.mock.calls[0];
    const headers = callArgs[1]?.headers ?? {};
    expect(headers['X-Dashboard-Signature-256']).toBeUndefined();
  });
});
