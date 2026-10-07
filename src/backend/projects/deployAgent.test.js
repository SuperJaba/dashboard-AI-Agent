import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { projectsRouter } from './projectsRouter.js';

describe('POST /deploy agent resolution', () => {
  const app = express();
  app.use(express.json());
  app.use('/', projectsRouter);

  it('deploys OpenClaude with openclaude binary without calling claude code', async () => {
    const res = await request(app)
      .post('/deploy')
      .send({
        agent: 'OpenClaude',
        useBrowserTerminal: true
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.scriptContent).toContain('openclaude');
    // Ensure it does not invoke claude or claude code onboarding
    expect(res.body.scriptContent).not.toContain('/bin/claude"');
    expect(res.body.scriptContent).not.toContain('CLAUDE_CODE_DISABLE_UNKNOWN_MODEL_WINDOW_ENFORCEMENT');
  });

  it('deploys Claude Code with claude binary', async () => {
    const res = await request(app)
      .post('/deploy')
      .send({
        agent: 'Claude Code',
        useBrowserTerminal: true
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.scriptContent).toContain('/claude"');
    expect(res.body.scriptContent).not.toContain('openclaude');
  });

  it('deploys Antigravity with agy binary', async () => {
    const res = await request(app)
      .post('/deploy')
      .send({
        agent: 'Antigravity',
        useBrowserTerminal: true
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.scriptContent).toContain('agy');
  });

  it('deploys Codex with local OSS Unsloth model and bypass flag', async () => {
    const res = await request(app)
      .post('/deploy')
      .send({
        agent: 'Codex',
        llmUrl: 'http://localhost:8888/v1',
        llmModel: 'unsloth/Qwen3.5-4B-MTP-GGUF',
        dangerouslySkipPermissions: true,
        useBrowserTerminal: true
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.scriptContent).toContain('codex');
    expect(res.body.scriptContent).toContain('--oss');
    expect(res.body.scriptContent).toContain('--local-provider lmstudio');
    expect(res.body.scriptContent).toContain('-m "unsloth/Qwen3.5-4B-MTP-GGUF"');
    expect(res.body.scriptContent).toContain('export CODEX_OSS_BASE_URL="http://localhost:8888/v1"');
    expect(res.body.scriptContent).toContain('--dangerously-bypass-approvals-and-sandbox');
    expect(res.body.scriptContent).not.toContain('--dangerously-skip-permissions');
  });

  it('deploys Codex with cloud OpenAI model without --oss', async () => {
    const res = await request(app)
      .post('/deploy')
      .send({
        agent: 'Codex',
        llmUrl: 'https://api.openai.com/v1',
        llmModel: 'gpt-5.5',
        useBrowserTerminal: true
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.scriptContent).toContain('codex');
    expect(res.body.scriptContent).toContain('-m "gpt-5.5"');
    expect(res.body.scriptContent).not.toContain('--oss');
    expect(res.body.scriptContent).not.toContain('CODEX_OSS_BASE_URL');
  });
});
