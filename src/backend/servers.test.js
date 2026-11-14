// servers.test.js - Test file for servers module
import { describe, it, expect } from 'vitest';

describe('serversRepository', () => {
  // Test repository functions
  it('should export repository object', () => {
    const serversRepo = require('./servers/serversRepository.js');
    expect(serversRepo).toBeDefined();
  });
  
  it('should have getServers function', () => {
    const serversRepo = require('./servers/serversRepository.js');
    expect(typeof serversRepo.getServers).toBe('function');
  });
});

describe('serversRouter', () => {
  it('should export router object', () => {
    const serversRouter = require('./servers/serversRouter.js');
    expect(serversRouter).toBeDefined();
  });
});
