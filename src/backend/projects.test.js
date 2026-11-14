// projects.test.js - Test file for projects module
import { describe, it, expect } from 'vitest';

describe('remoteSyncService', () => {
  // Test remoteSyncService exports
  it('should export remoteSyncService object', () => {
    const remoteSyncService = require('./projects/remoteSyncService.js');
    expect(remoteSyncService).toBeDefined();
  });
  
  it('should have fetchRemoteTasks function', () => {
    const remoteSyncService = require('./projects/remoteSyncService.js');
    expect(typeof remoteSyncService.fetchRemoteTasks).toBe('function');
  });
});

describe('tasksSyncService', () => {
  // Test tasksSyncService exports
  it('should export tasksSyncService object', () => {
    const tasksSyncService = require('./projects/tasksSyncService.js');
    expect(tasksSyncService).toBeDefined();
  });
  
  it('should have normalizeTitle function', () => {
    const tasksSyncService = require('./projects/tasksSyncService.js');
    expect(typeof tasksSyncService.normalizeTitle).toBe('function');
  });
});

describe('techDetector', () => {
  // Test techDetector exports
  it('should export techDetector object', () => {
    const techDetector = require('./projects/techDetector.js');
    expect(techDetector).toBeDefined();
  });
  
  it('should have detectTechnology function', () => {
    const techDetector = require('./projects/techDetector.js');
    expect(typeof techDetector.detectTechnology).toBe('function');
  });
});
