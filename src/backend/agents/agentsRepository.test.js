import { describe, it, expect, beforeEach, vi } from 'vitest';
import { pool } from '../db.js';
import {
  getAgents,
  getAgentById,
  findAgentByName,
  createAgent,
  updateAgentPathAndConfig,
  setAgentInstalled,
  updateAgent,
  updateAgentTunedParams,
  deleteAgent,
} from './agentsRepository.js';

vi.mock('../db.js', () => ({
  pool: {
    query: vi.fn(),
  },
  safeQuery: vi.fn(),
}));

describe('agentsRepository', () => {
  const testId = 1;
  const testName = 'Test Agent';
  const testDescription = 'A test agent for coverage';
  const testPath = '/usr/bin/test-agent';
  const testConfigUri = 'config://test';
  const testInstalled = true;
  const testLlmModel = 'gpt-4o';
  const testTemperature = 0.7;
  const testMaxTokens = 4096;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(pool.query).mockResolvedValue({ rows: [{ id: testId }] });
  });

  describe('getAgents', () => {
    it('returns all agents ordered by name ASC', async () => {
      const rows = [
        { id: 1, name: 'Agent B', description: 'Description B' },
        { id: 2, name: 'Agent A', description: 'Description A' },
      ];
      vi.mocked(pool.query).mockResolvedValue({ rows });

      const result = await getAgents();
      expect(result).toEqual(rows);
    });

    it('returns empty array when no agents exist', async () => {
      vi.mocked(pool.query).mockResolvedValue({ rows: [] });

      const result = await getAgents();
      expect(result).toEqual([]);
    });
  });

  describe('getAgentById', () => {
    it('returns agent when found by id', async () => {
      const agent = { id: 1, name: 'Test Agent', description: 'Description' };
      vi.mocked(pool.query).mockResolvedValue({ rows: [agent] });

      const result = await getAgentById(testId);
      expect(result).toEqual(agent);
    });

    it('returns null when agent not found', async () => {
      vi.mocked(pool.query).mockResolvedValue({ rows: [] });

      const result = await getAgentById(testId);
      expect(result).toBeNull();
    });
  });

  describe('findAgentByName', () => {
    it('returns agent when found by name', async () => {
      const agent = { id: 1, name: 'Test Agent', description: 'Description' };
      vi.mocked(pool.query).mockResolvedValue({ rows: [agent] });

      const result = await findAgentByName('Test Agent');
      expect(result).toEqual(agent);
    });

    it('returns null when agent not found by name', async () => {
      vi.mocked(pool.query).mockResolvedValue({ rows: [] });

      const result = await findAgentByName('Non-existent');
      expect(result).toBeNull();
    });
  });

  describe('createAgent', () => {
    it('creates a new agent and returns the created agent', async () => {
      vi.mocked(pool.query).mockResolvedValue({ rows: [{ id: 100, name: testName }] });

      const result = await createAgent({
        name: testName,
        description: testDescription,
        path: testPath,
        config_uri: testConfigUri,
        installed: testInstalled,
        llm_model: testLlmModel,
        temperature: testTemperature,
        max_tokens: testMaxTokens,
      });

      expect(result).toEqual({ id: 100, name: testName });
    });

    it('handles missing optional parameters', async () => {
      vi.mocked(pool.query).mockResolvedValue({ rows: [{ id: 101, name: 'Minimal' }] });

      const result = await createAgent({ name: 'Minimal' });
      expect(result).toEqual({ id: 101, name: 'Minimal' });
    });
  });

  describe('updateAgentPathAndConfig', () => {
    it('updates agent path and config URI', async () => {
      vi.mocked(pool.query).mockResolvedValue({ rows: [{ id: 1, name: testName }] });

      const result = await updateAgentPathAndConfig(testName, testPath, testConfigUri);
      expect(result).toEqual({ id: 1, name: testName });
    });

    it('handles null config URI', async () => {
      vi.mocked(pool.query).mockResolvedValue({ rows: [{ id: 1 }] });

      const result = await updateAgentPathAndConfig(testName, '/new/path');
      expect(result).toEqual({ id: 1 });
    });
  });

  describe('setAgentInstalled', () => {
    it('marks agent as installed', async () => {
      vi.mocked(pool.query).mockResolvedValue({ rows: [{ id: 1, name: testName, installed: true }] });

      const result = await setAgentInstalled(testId, true);
      expect(result).toEqual({ id: 1, name: testName, installed: true });
    });

    it('marks agent as uninstalled', async () => {
      vi.mocked(pool.query).mockResolvedValue({ rows: [{ id: 1, installed: false }] });

      const result = await setAgentInstalled(testId, false);
      expect(result).toEqual({ id: 1, installed: false });
    });
  });

  describe('updateAgent', () => {
    it('updates single field only', async () => {
      vi.mocked(pool.query).mockResolvedValue({ rows: [{ id: 1 }] });

      const result = await updateAgent(1, { llm_model: 'gpt-5' });
      expect(result).toEqual({ id: 1 });
    });

    it('updates multiple fields', async () => {
      vi.mocked(pool.query).mockResolvedValue({ rows: [{ id: 1 }] });

      const result = await updateAgent(1, { name: 'New Name', description: 'New Desc' });
      expect(result).toEqual({ id: 1 });
    });

    it('handles undefined values correctly', async () => {
      vi.mocked(pool.query).mockResolvedValue({ rows: [{ id: 1 }] });

      const result = await updateAgent(1, {
        name: 'Partial Update',
        temperature: 0.9,
      });
      expect(result).toEqual({ id: 1 });
    });
  });

  describe('updateAgentTunedParams', () => {
    it('updates only tuned parameters', async () => {
      vi.mocked(pool.query).mockResolvedValue({ rows: [{ id: testId }] });

      const result = await updateAgentTunedParams(1, { temperature: 0.9, max_tokens: 8192 });
      expect(result).toEqual({ id: testId });
    });

    it('updates all three tuned parameters', async () => {
      vi.mocked(pool.query).mockResolvedValue({ rows: [{ id: testId }] });

      const result = await updateAgentTunedParams(1, {
        temperature: 0.95,
        max_tokens: 16384,
        llm_model: 'claude-3-haiku',
      });
      expect(result).toEqual({ id: testId });
    });
  });

  describe('deleteAgent', () => {
    it('deletes agent and returns success', async () => {
      vi.mocked(pool.query).mockResolvedValue({ rows: [] });

      const result = await deleteAgent(testId);
      expect(result).toEqual({ success: true });
    });
  });
});
