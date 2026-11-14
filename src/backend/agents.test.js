// agents.test.js - Test file for agents module
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { pool } from './db.js';
import * as agentsRepo from './agents/agentsRepository.js';
import * as agentsRouter from './agents/agentsRouter.js';

vi.mock('./db.js', () => ({
  pool: {
    query: vi.fn(),
  },
  safeQuery: vi.fn(),
}));

describe('agentsRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return empty array when no agents exist', async () => {
    vi.mocked(pool.query).mockResolvedValue({ rows: [] });
    const result = await agentsRepo.getAgents();
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });

  it('should find agent by id', async () => {
    vi.mocked(pool.query).mockResolvedValue({ rows: [{ id: 1, name: 'test-agent' }] });
    const result = await agentsRepo.getAgentById(1);
    expect(result?.id).toBe(1);
    expect(result?.name).toBe('test-agent');
  });

  it('should return null when agent not found by id', async () => {
    vi.mocked(pool.query).mockResolvedValue({ rows: [] });
    const result = await agentsRepo.getAgentById(999);
    expect(result).toBeNull();
  });

  it('should find agent by name', async () => {
    vi.mocked(pool.query).mockResolvedValue({ rows: [{ id: 2, name: 'my-agent' }] });
    const result = await agentsRepo.findAgentByName('my-agent');
    expect(result?.id).toBe(2);
    expect(result?.name).toBe('my-agent');
  });

  it('should return null when agent not found by name', async () => {
    vi.mocked(pool.query).mockResolvedValue({ rows: [] });
    const result = await agentsRepo.findAgentByName('nonexistent');
    expect(result).toBeNull();
  });

  it('should create a new agent', async () => {
    vi.mocked(pool.query).mockResolvedValue({
      rows: [{ id: 3, name: 'new-agent', description: 'test', path: '/bin/claude', config_uri: '', installed: true, llm_model: 'gpt-4o', temperature: 0.7, max_tokens: 4096 }]
    });
    const result = await agentsRepo.createAgent({
      name: 'new-agent',
      description: 'test agent',
      path: '/bin/claude',
      config_uri: '',
      installed: true,
      llm_model: 'gpt-4o',
      temperature: 0.7,
      max_tokens: 4096
    });
    expect(result?.id).toBe(3);
    expect(result?.name).toBe('new-agent');
  });

  it('should update agent path and config', async () => {
    vi.mocked(pool.query).mockResolvedValue({ rows: [{ id: 1, name: 'test' }] });
    const result = await agentsRepo.updateAgentPathAndConfig('test', '/bin/newclaude', '/config.json');
    expect(result?.id).toBe(1);
  });

  it('should set agent installed status', async () => {
    vi.mocked(pool.query).mockResolvedValue({ rows: [{ id: 1, name: 'test' }] });
    const result = await agentsRepo.setAgentInstalled(1, true);
    expect(result?.id).toBe(1);
  });

  it('should update agent with partial fields', async () => {
    vi.mocked(pool.query).mockResolvedValue({ rows: [{ id: 1, name: 'test', description: 'old' }] });
    const result = await agentsRepo.updateAgent(1, { name: 'updated', temperature: 0.8 });
    expect(result?.id).toBe(1);
  });

  it('should update agent tuned params', async () => {
    vi.mocked(pool.query).mockResolvedValue({ rows: [{ id: 1, name: 'test', temperature: 0.5 }] });
    const result = await agentsRepo.updateAgentTunedParams(1, { temperature: 0.6, max_tokens: 8192, llm_model: 'claude-3-5-sonnet' });
    expect(result?.id).toBe(1);
  });

  it('should delete agent', async () => {
    vi.mocked(pool.query).mockResolvedValue({ rows: [] });
    const result = await agentsRepo.deleteAgent(1);
    expect(result.success).toBe(true);
  });
});

describe('agentsRouter', () => {
  it('should export router object', () => {
    expect(agentsRouter.agentsRouter).toBeDefined();
    expect(typeof agentsRouter.agentsRouter).toBe('function');
  });

  it('should expose findInPath function', () => {
    expect(typeof agentsRouter.findInPath).toBe('function');
  });

  it('should expose KNOWN_AGENTS array', () => {
    expect(Array.isArray(agentsRouter.KNOWN_AGENTS)).toBe(true);
    expect(agentsRouter.KNOWN_AGENTS.length).toBeGreaterThan(0);
  });
});
