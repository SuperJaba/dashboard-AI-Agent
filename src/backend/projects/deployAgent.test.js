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
    expect(res.body.scriptContent).toMatch(/[/"]claude"/);
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
      .set('x-admin-role', 'true')
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

  it('includes sync-tasks instructions and automated post-run sync in scriptContent when tasks are provided', async () => {
    const res = await request(app)
      .post('/deploy')
      .send({
        agent: 'Claude Code',
        tasks: [{ title: 'Write unit tests', status: 'pending' }],
        useBrowserTerminal: true
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // Instruction in prompt
    expect(res.body.scriptContent).toContain('node src/backend/scripts/syncTasks.js');
    expect(res.body.scriptContent).toContain('/api/scripts/syncTasks.js');
    // Post-execution fallback in bash script
    expect(res.body.scriptContent).toContain('Synchronizing tasks (sync-tasks)');
    // Injected DASHBOARD_TOKEN and API_TOKEN
    expect(res.body.scriptContent).toContain('export DASHBOARD_TOKEN=');
    expect(res.body.scriptContent).toContain('export API_TOKEN=');
  });

  it('serves project by name via GET /projects/:id', async () => {
    const res = await request(app).get('/projects/dashboard');
    if (res.status === 200) {
      expect(res.body.name).toBe('dashboard');
    } else {
      expect(res.status).toBe(404);
    }
  });

  it('serves syncTasks.js via public download route', async () => {
    const res = await request(app).get('/scripts/syncTasks.js');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/javascript');
    expect(res.text).toContain('Task Synchronization Engine');
  });

  it('synchronizes tasks via POST /projects/sync-tasks', async () => {
    const res = await request(app)
      .post('/projects/sync-tasks')
      .send({ cwd: process.cwd() });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('allows remote prompt containing ssh and log analysis without prompt-injection false-positive', async () => {
    const res = await request(app)
      .post('/deploy')
      .send({
        agent: 'agy',
        remoteServer: { id: 2, name: 'CT8', host: 's1.ct8.pl', username: 'jagger2', port: 22 },
        remotePrompt: "Przeanalizuj logi systemowe w poszukiwaniu błędów i przygotuj raport.\nssh -i /home/seba/.ssh/id_ed25519_antigravity jagger2@s1.ct8.pl 'devil www restart dashboard.jagger2.ct8.pl'",
        useBrowserTerminal: true
      });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.scriptContent).toContain('Przeanalizuj logi systemowe');
    expect(res.body.scriptContent).toContain('devil www restart');
  });
});
