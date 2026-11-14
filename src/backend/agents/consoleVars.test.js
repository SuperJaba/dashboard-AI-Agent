import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import * as consoleVarsRepo from './consoleVarsRepository.js';
import { agentsRouter } from './agentsRouter.js';

describe('Console Variables & CLI Environment', () => {
  beforeEach(async () => {
    // Reset or seed test console variables
    await consoleVarsRepo.saveConsoleVars({
      token: 'test-secret-token',
      model: 'unsloth/Qwen3.5-9B-MTP-GGUF',
      ip: 'http://127.0.0.1:8888/v1'
    });
  });

  describe('normalizeBaseUrl & helper functions', () => {
    it('normalizes various IP / URL formats correctly with /v1', () => {
      expect(consoleVarsRepo.normalizeBaseUrl('127.0.0.1:8888')).toBe('http://127.0.0.1:8888/v1');
      expect(consoleVarsRepo.normalizeBaseUrl('http://127.0.0.1:8888/v1/')).toBe('http://127.0.0.1:8888/v1');
      expect(consoleVarsRepo.normalizeBaseUrl('http://10.10.10.30:8888/v1/chat/completions')).toBe('http://10.10.10.30:8888/v1');
      expect(consoleVarsRepo.normalizeBaseUrl('https://api.openai.com/v1')).toBe('https://api.openai.com/v1');
    });

    it('returns clean root base without /v1 for Anthropic compatibility', () => {
      expect(consoleVarsRepo.getCleanRootBase('http://127.0.0.1:8888/v1')).toBe('http://127.0.0.1:8888');
      expect(consoleVarsRepo.getCleanRootBase('http://localhost:11434')).toBe('http://localhost:11434');
    });

    it('generates valid export commands for Bash, PowerShell, and .env', () => {
      const commands = consoleVarsRepo.buildExportCommands({
        token: 'my-token-123',
        model: 'qwen3.5-9b',
        ip: 'http://10.10.10.30:8888/v1'
      });

      expect(commands.bash).toContain('export OPENAI_BASE_URL="http://10.10.10.30:8888/v1"');
      expect(commands.bash).toContain('export OPENAI_API_KEY="my-token-123"');
      expect(commands.bash).toContain('export OPENAI_MODEL="qwen3.5-9b"');
      expect(commands.bash).toContain('export ANTHROPIC_BASE_URL="http://10.10.10.30:8888"');

      expect(commands.powershell).toContain('$env:OPENAI_BASE_URL = "http://10.10.10.30:8888/v1"');
      expect(commands.powershell).toContain('$env:OPENAI_API_KEY = "my-token-123"');

      expect(commands.env).toContain('OPENAI_BASE_URL=http://10.10.10.30:8888/v1');
      expect(commands.env).toContain('OPENAI_API_KEY=my-token-123');
    });
  });

  describe('Repository Operations (DB Persistence)', () => {
    it('retrieves stored console variables from DB with decrypted token', async () => {
      const vars = await consoleVarsRepo.getConsoleVars();
      expect(vars.id).toBe(1);
      expect(vars.ip).toBe('http://127.0.0.1:8888/v1');
      expect(vars.model).toBe('unsloth/Qwen3.5-9B-MTP-GGUF');
      expect(vars.token).toBe('test-secret-token');
      expect(vars.exportCommands).toBeDefined();
    });

    it('saves updated console variables and synchronizes with settings table', async () => {
      const result = await consoleVarsRepo.saveConsoleVars({
        token: 'new-auth-token-456',
        model: 'lmstudio-community/gpt-oss-20b-GGUF',
        ip: 'http://10.10.10.30:8888'
      });

      expect(result.success).toBe(true);
      expect(result.token).toBe('new-auth-token-456');
      expect(result.model).toBe('lmstudio-community/gpt-oss-20b-GGUF');
      expect(result.ip).toBe('http://10.10.10.30:8888/v1');

      const reloaded = await consoleVarsRepo.getConsoleVars();
      expect(reloaded.token).toBe('new-auth-token-456');
      expect(reloaded.model).toBe('lmstudio-community/gpt-oss-20b-GGUF');
      expect(reloaded.ip).toBe('http://10.10.10.30:8888/v1');
    });
  });

  describe('Connection Diagnostics / Probing', () => {
    it('gracefully handles unreachable host with timeout error', async () => {
      const res = await consoleVarsRepo.testConsoleConnection({
        token: 'tok',
        model: 'model',
        ip: 'http://192.0.2.1:8888/v1' // Non-routable TEST-NET IP for fast timeout
      });

      expect(res.success).toBe(false);
      expect(res.status).toBe('offline');
      expect(res.error).toBeDefined();
    });

    it('detects Unsloth Studio or active server when reachable', async () => {
      // Mock global fetch
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockImplementation(async (url) => {
        if (url.includes('/v1/models')) {
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
        if (url.includes('/v1/chat/completions')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              choices: [{ message: { content: 'OK' } }],
              usage: { completion_tokens: 5 }
            })
          };
        }
        return { ok: false, status: 404 };
      });

      try {
        const res = await consoleVarsRepo.testConsoleConnection({
          token: '',
          model: 'unsloth/Qwen3.5-9B-MTP-GGUF',
          ip: 'http://127.0.0.1:8888/v1'
        });

        expect(res.success).toBe(true);
        expect(res.serverType).toBe('Unsloth Studio');
        expect(res.loadedModel).toBe('unsloth/Qwen3.5-9B-MTP-GGUF');
        expect(res.latency).toBeTypeOf('number');
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe('HTTP Endpoints (/api/agents/console-vars)', () => {
    const app = express();
    app.use(express.json());
    app.use('/api/agents', agentsRouter);

    it('GET /api/agents/console-vars returns current settings', async () => {
      const res = await request(app).get('/api/agents/console-vars');
      expect(res.status).toBe(200);
      expect(res.body.ip).toBeDefined();
      expect(res.body.model).toBeDefined();
      expect(res.body.exportCommands).toBeDefined();
    });

    it('POST /api/agents/console-vars saves new settings', async () => {
      const res = await request(app)
        .post('/api/agents/console-vars')
        .send({
          token: 'api-secret-123',
          model: 'unsloth/Qwen3.5-9B-MTP-GGUF',
          ip: 'http://127.0.0.1:8888/v1'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBe('api-secret-123');
    });

    it('POST /api/agents/console-vars/test triggers diagnostics probe', async () => {
      const res = await request(app)
        .post('/api/agents/console-vars/test')
        .send({
          token: '',
          model: 'unsloth/Qwen3.5-9B-MTP-GGUF',
          ip: 'http://127.0.0.1:8888/v1'
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success');
      expect(res.body).toHaveProperty('status');
    });
  });
});
