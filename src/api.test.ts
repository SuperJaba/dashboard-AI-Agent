import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiFetch } from './api';

describe('apiFetch', () => {
  beforeEach(() => {
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue('mock-jwt-token');
    globalThis.fetch = vi.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve({ success: true }),
      })
    ) as any;
  });

  it('calls fetch with the correct Authorization header', async () => {
    await apiFetch('http://localhost:3001/test-endpoint');

    expect(globalThis.fetch).toHaveBeenCalledWith('http://localhost:3001/test-endpoint', expect.objectContaining({
      headers: expect.objectContaining({
        'Authorization': 'Bearer mock-jwt-token'
      })
    }));
  });

  it('merges custom options and headers', async () => {
    await apiFetch('http://localhost:3001/test-endpoint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    expect(globalThis.fetch).toHaveBeenCalledWith('http://localhost:3001/test-endpoint', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        'Content-Type': 'application/json',
        'Authorization': 'Bearer mock-jwt-token'
      })
    }));
  });
});
