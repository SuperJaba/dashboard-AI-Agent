import { describe, it, expect, vi, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { settingsRouter, normalizeLlmBase, detectGpuInfo } from './settingsRouter.js';

describe('LLM Diagnostics & Tuning (/api/settings/llm/tune)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('normalizeLlmBase', () => {
    it('strips trailing slashes, /chat/completions and /v1 without duplicating', () => {
      expect(normalizeLlmBase('http://127.0.0.1:8888/v1')).toBe('http://127.0.0.1:8888');
      expect(normalizeLlmBase('http://127.0.0.1:8888/v1/')).toBe('http://127.0.0.1:8888');
      expect(normalizeLlmBase('http://127.0.0.1:8888/v1/chat/completions')).toBe('http://127.0.0.1:8888');
      expect(normalizeLlmBase('http://127.0.0.1:8888')).toBe('http://127.0.0.1:8888');
      expect(normalizeLlmBase('http://localhost:11434')).toBe('http://localhost:11434');
      expect(normalizeLlmBase('http://10.10.10.30:8888/v1')).toBe('http://10.10.10.30:8888');
    });
  });

  describe('detectGpuInfo', () => {
    it('returns a non-empty GPU info string', () => {
      const gpu = detectGpuInfo();
      expect(gpu).toBeDefined();
      expect(typeof gpu).toBe('string');
      expect(gpu.length).toBeGreaterThan(0);
      if (process.platform === 'darwin') {
        expect(gpu).toMatch(/Apple|Metal/i);
      }
    });
  });

  describe('POST /api/settings/llm/tune endpoint', () => {
    const app = express();
    app.use(express.json());
    app.use('/api/settings', settingsRouter);

    it('successfully detects and tunes Unsloth Studio when server responds', async () => {
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockImplementation(async (url) => {
        if (typeof url === 'string' && url.includes('/v1/models')) {
          return {
            ok: true,
            status: 200,
            headers: new Headers({ server: 'unsloth-studio' }),
            json: async () => ({
              object: 'list',
              data: [
                { id: 'unsloth/Qwen3.5-9B-MTP-GGUF', loaded: true, status: { value: 'loaded' } }
              ]
            })
          };
        }
        if (typeof url === 'string' && url.includes('/v1/chat/completions')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              choices: [{ message: { content: 'OK' } }],
              usage: { completion_tokens: 8 }
            })
          };
        }
        return { ok: false, status: 404 };
      });

      try {
        const res = await request(app).post('/api/settings/llm/tune');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.status).toBe('success');
        expect(res.body.type).toBe('Unsloth Studio');
        expect(res.body.loadedModel).toContain('Qwen3.5');
        expect(res.body.systemResources).toBeDefined();
        expect(res.body.systemResources.cpu).toBeDefined();
        expect(res.body.systemResources.ram).toBeDefined();
        expect(res.body.systemResources.gpu).toBeDefined();
        expect(res.body.recommendations.length).toBeGreaterThan(0);
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('gracefully handles offline state when no local LLM is running', async () => {
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

      try {
        const res = await request(app).post('/api/settings/llm/tune');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.status).toBe('failed');
        expect(res.body.loadedModel).toBe('Brak / Nie wykryto');
        expect(res.body.recommendations[0]).toContain('No local or configured LLM server detected');
      } finally {
        global.fetch = originalFetch;
      }
    });
  });
});
