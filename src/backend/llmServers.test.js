// llmServers.test.js - Test file for llmServers module
import { describe, it, expect } from 'vitest';

describe('llmServersRepository', () => {
  // Test repository functions
  it('should export repository object', () => {
    const llmServersRepo = require('./llmServers/llmServersRepository.js');
    expect(llmServersRepo).toBeDefined();
  });
  
  it('should have getLlmServers function', () => {
    const llmServersRepo = require('./llmServers/llmServersRepository.js');
    expect(typeof llmServersRepo.getLlmServers).toBe('function');
  });
  
  it('should have createLlmServer function', () => {
    const llmServersRepo = require('./llmServers/llmServersRepository.js');
    expect(typeof llmServersRepo.createLlmServer).toBe('function');
  });
});

describe('llmServersRouter', () => {
  it('should export router object', () => {
    const llmServersRouter = require('./llmServers/llmServersRouter.js');
    expect(llmServersRouter).toBeDefined();
  });
});
