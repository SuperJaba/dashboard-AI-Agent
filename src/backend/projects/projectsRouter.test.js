import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { projectsRouter } from './projectsRouter.js';
import * as agentsRepo from '../agents/agentsRepository.js';
import * as settingsRepo from '../settings/settingsRepository.js';

describe('projectsRouter - deploy agent handling', () => {
  let tmpDir;
  let app;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deploy-agent-test-'));
    app = express();
    app.use(express.json());
    app.use('/api/projects', projectsRouter);

    vi.spyOn(settingsRepo, 'getSettings').mockResolvedValue({
      llmUrl: '',
      apiKey: '',
      llmName: 'Custom Provider',
      llmModel: ''
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('generates start script with openclaude binary when Open Claude agent is selected from DB', async () => {
    // Create a mock executable file in tmpDir to simulate existing binary
    const mockOpenClaudeBin = path.join(tmpDir, 'openclaude-bin');
    fs.writeFileSync(mockOpenClaudeBin, '#!/bin/sh\n', { mode: 0o755 });

    vi.spyOn(agentsRepo, 'getAgents').mockResolvedValue([
      {
        id: 6,
        name: 'Open Claude',
        path: mockOpenClaudeBin,
        config_uri: '~/.openclaude/settings.json',
        installed: true
      }
    ]);

    const res = await request(app)
      .post('/api/projects/deploy')
      .send({
        agent: 'Open Claude',
        directory: tmpDir,
        useBrowserTerminal: true
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.browserTerminal).toBe(true);

    const scriptPath = path.join(tmpDir, '.start_agent.sh');
    expect(fs.existsSync(scriptPath)).toBe(true);
    const content = fs.readFileSync(scriptPath, 'utf8');

    // Must execute openclaude binary path and NOT Anthropic "claude"
    expect(content).toContain(`"${mockOpenClaudeBin}"`);
    expect(content).not.toMatch(/"claude"/);
    expect(content).not.toContain('CLAUDE_CODE_DISABLE_UNKNOWN_MODEL_WINDOW_ENFORCEMENT');
  });

  it('falls back to openclaude when raw agent name is openclaude or open claude without existing path', async () => {
    vi.spyOn(agentsRepo, 'getAgents').mockResolvedValue([]);

    const res = await request(app)
      .post('/api/projects/deploy')
      .send({
        agent: 'open claude',
        directory: tmpDir,
        useBrowserTerminal: true
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const scriptPath = path.join(tmpDir, '.start_agent.sh');
    const content = fs.readFileSync(scriptPath, 'utf8');

    expect(content).toContain('"openclaude"');
    expect(content).not.toMatch(/"claude"/);
  });

  it('keeps "claude" execution for Claude Code agent', async () => {
    vi.spyOn(agentsRepo, 'getAgents').mockResolvedValue([
      {
        id: 1,
        name: 'Claude Code',
        path: '',
        config_uri: '~/.claude.json',
        installed: true
      }
    ]);

    const res = await request(app)
      .post('/api/projects/deploy')
      .send({
        agent: 'Claude Code',
        directory: tmpDir,
        useBrowserTerminal: true
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const scriptPath = path.join(tmpDir, '.start_agent.sh');
    const content = fs.readFileSync(scriptPath, 'utf8');

    expect(content).toContain('"claude"');
    expect(content).not.toContain('"openclaude"');
  });
});
