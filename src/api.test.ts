import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient } from './shared/api-client';

describe('apiClient', () => {
  beforeEach(() => {
    localStorage.setItem('dashboard_token', 'mock-jwt-token');
    if (typeof localStorage.getItem === 'function') {
      vi.spyOn(localStorage, 'getItem').mockReturnValue('mock-jwt-token');
    }
    globalThis.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true }),
      } as Response)
    );
  });

  it('calls fetch with the correct Authorization header', async () => {
    await apiClient.get('/test-endpoint');

    expect(globalThis.fetch).toHaveBeenCalledWith('http://localhost:3001/test-endpoint', expect.objectContaining({
      headers: expect.objectContaining({
        'Authorization': 'Bearer mock-jwt-token'
      })
    }));
  });

  it('merges custom options and headers', async () => {
    await apiClient.post('/test-endpoint', { foo: 'bar' });

    expect(globalThis.fetch).toHaveBeenCalledWith('http://localhost:3001/test-endpoint', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ foo: 'bar' }),
      headers: expect.objectContaining({
        'Content-Type': 'application/json',
        'Authorization': 'Bearer mock-jwt-token'
      })
    }));
  });
});
