import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { settingsRouter, normalizeLlmBase, detectGpuInfo } from './settingsRouter.js';

describe('LLM Diagnostics & Tuning (/api/settings/llm/tune)', () => {
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

    it('successfully detects the running local LLM server', async () => {
      const res = await request(app).post('/api/settings/llm/tune');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.status).toBe('success');
      expect(res.body.llmUrl).toContain('8888');
      expect(res.body.type).toBe('Unsloth Studio');
      expect(res.body.loadedModel).toContain('Qwen3.5');
      expect(res.body.systemResources).toBeDefined();
      expect(res.body.systemResources.cpu).toBeDefined();
      expect(res.body.systemResources.ram).toBeDefined();
      expect(res.body.systemResources.gpu).toBeDefined();
      expect(res.body.recommendations.length).toBeGreaterThan(0);
    });
  });
});
