// agents.test.js - Test file for agents module
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as agentsRepo from './agents/agentsRepository.js';
import * as agentsRouter from './agents/agentsRouter.js';

describe('agentsRepository', () => {
  let mockPool = null;
  
  // Mock pool for testing
  beforeAll(() => {
    mockPool = {
      query: async (query, params) => ({ rows: [] })
    };
    jest.spyOn(require('../db.js'), 'pool').query = mockPool.query;
  });
  
  afterAll(() => {
    if (mockPool && mockPool.query) {
      delete mockPool.query;
    }
    jest.restoreAllMocks();
  });
  
  it('should return empty array when no agents exist', async () => {
    const result = await agentsRepo.getAgents();
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });
  
  it('should find agent by id', async () => {
    mockPool.query = async (query, params) => ({ rows: [{ id: 1, name: 'test-agent' }] });
    const result = await agentsRepo.getAgentById(1);
    expect(result?.id).toBe(1);
    expect(result?.name).toBe('test-agent');
  });
  
  it('should return null when agent not found by id', async () => {
    mockPool.query = async (query, params) => ({ rows: [] });
    const result = await agentsRepo.getAgentById(999);
    expect(result).toBeNull();
  });
  
  it('should find agent by name', async () => {
    mockPool.query = async (query, params) => ({ rows: [{ id: 2, name: 'my-agent' }] });
    const result = await agentsRepo.findAgentByName('my-agent');
    expect(result?.id).toBe(2);
    expect(result?.name).toBe('my-agent');
  });
  
  it('should return null when agent not found by name', async () => {
    mockPool.query = async (query, params) => ({ rows: [] });
    const result = await agentsRepo.findAgentByName('nonexistent');
    expect(result).toBeNull();
  });
  
  it('should create a new agent', async () => {
    mockPool.query = async (query, params) => ({ 
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
    mockPool.query = async (query, params) => ({ rows: [{ id: 1, name: 'test' }] });
    const result = await agentsRepo.updateAgentPathAndConfig('test', '/bin/newclaude', '/config.json');
    expect(result?.id).toBe(1);
  });
  
  it('should set agent installed status', async () => {
    mockPool.query = async (query, params) => ({ rows: [{ id: 1, name: 'test' }] });
    const result = await agentsRepo.setAgentInstalled(1, true);
    expect(result?.id).toBe(1);
  });
  
  it('should update agent with partial fields', async () => {
    mockPool.query = async (query, params) => ({ rows: [{ id: 1, name: 'test', description: 'old' }] });
    const result = await agentsRepo.updateAgent(1, { name: 'updated', temperature: 0.8 });
    expect(result?.id).toBe(1);
  });
  
  it('should update agent tuned params', async () => {
    mockPool.query = async (query, params) => ({ rows: [{ id: 1, name: 'test', temperature: 0.5 }] });
    const result = await agentsRepo.updateAgentTunedParams(1, { temperature: 0.6, max_tokens: 8192, llm_model: 'claude-3-5-sonnet' });
    expect(result?.id).toBe(1);
  });
  
  it('should delete agent', async () => {
    mockPool.query = async (query, params) => ({ rows: [] });
    const result = await agentsRepo.deleteAgent(1);
    expect(result.success).toBe(true);
  });
});

describe('agentsRouter', () => {
  it('should export router object', () => {
    expect(typeof agentsRouter.agentsRouter).toBe('object');
  });
  
  it('should expose findInPath function', () => {
    expect(typeof agentsRouter.findInPath).toBe('function');
  });
  
  it('should have GET / endpoint handler', () => {
    const routes = Object.keys(agentsRouter.agentsRouter._events);
    expect(routes.includes('/')).toBe(true);
  });
  
  it('should have POST /scan endpoint handler', () => {
    const routes = Object.keys(agentsRouter.agentsRouter._events);
    expect(routes.includes('/scan')).toBe(true);
  });
});
