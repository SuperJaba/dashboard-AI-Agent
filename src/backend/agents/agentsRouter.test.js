import { describe, it, expect } from 'vitest';
import { KNOWN_AGENTS } from './agentsRouter.js';
import { getAgentCmd } from './backgroundWorker.js';

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
});
