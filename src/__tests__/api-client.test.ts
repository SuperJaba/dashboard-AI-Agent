import { describe, it, expect, vi } from 'vitest';
import { apiClient, ApiError } from '../shared/api-client/client';

vi.stubGlobal('fetch', vi.fn());

const mockJson = (data:any) => ({ ok: true, status: 200, json: vi.fn().mockResolvedValue(data), text: vi.fn() });

describe('apiClient GET', () => {
  it('returns data on success', async () => {
    const mockResponse = mockJson({ id: 1 });
    (fetch as any).mockResolvedValue(mockResponse);
    const result = await apiClient.get<{id:number}>('/test');
    expect(result.id).toBe(1);
  });

  it('throws ApiError on non-2xx', async () => {
    const mockResp = { ok: false, status: 404, json: vi.fn().mockResolvedValue({ error:'not found'}), text: vi.fn() };
    (fetch as any).mockResolvedValue(mockResp);
    await expect(apiClient.get('/bad')).rejects.toThrow(ApiError);
  });
});