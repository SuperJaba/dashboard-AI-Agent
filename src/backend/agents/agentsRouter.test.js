import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { KNOWN_AGENTS, agentsRouter } from './agentsRouter.js';
import { getAgentCmd } from './backgroundWorker.js';
import * as emergencyService from './emergencyService.js';

vi.mock('./emergencyService.js', () => ({
  triggerEmergencyStop: vi.fn(),
}));

describe('Agents router and background worker Open Claude integration', () => {
  it('registers Open Claude in KNOWN_AGENTS catalog with correct command and config path', () => {
    const openClaudeEntry = KNOWN_AGENTS.find(a => a.name === 'Open Claude');
    expect(openClaudeEntry).toBeDefined();
    expect(openClaudeEntry.cmd).toBe('openclaude');
    expect(openClaudeEntry.desc).toContain('OpenClaude');
    expect(openClaudeEntry.configPath('/home/testuser')).toBe('/home/testuser/.openclaude/settings.json');
  });

  it('resolves correct CLI command via getAgentCmd for Open Claude and Claude Code', () => {
    expect(getAgentCmd('Open Claude')).toBe('openclaude');
    expect(getAgentCmd('openclaude')).toBe('openclaude');
    expect(getAgentCmd('open claude')).toBe('openclaude');
    expect(getAgentCmd('Claude Code')).toBe('claude');
    expect(getAgentCmd('Antigravity')).toBe('agy');
  });

  it('POST /emergency-stop invokes triggerEmergencyStop and returns summary', async () => {
    emergencyService.triggerEmergencyStop.mockResolvedValueOnce({
      success: true,
      terminatedTasks: 2,
      killedProcesses: 3,
      freedVram: true,
    });

    const app = express();
    app.use(express.json());
    app.use('/api/agents', agentsRouter);

    const res = await request(app).post('/api/agents/emergency-stop');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      terminatedTasks: 2,
      killedProcesses: 3,
      freedVram: true,
    });
    expect(emergencyService.triggerEmergencyStop).toHaveBeenCalled();
  });
});

