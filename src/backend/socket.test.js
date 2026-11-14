// socket.test.js - Test file for socket module
import { describe, it, expect } from 'vitest';

describe('dashboardNamespace', () => {
  // Test namespace functions
  it('should export dashboardNamespace object', () => {
    const dashboardNS = require('./socket/dashboardNamespace.js');
    expect(dashboardNS).toBeDefined();
  });
  
  it('should have registerDashboardNamespace function', () => {
    const dashboardNS = require('./socket/dashboardNamespace.js');
    expect(typeof dashboardNS.registerDashboardNamespace).toBe('function');
  });
});

describe('ptyNamespace', () => {
  // Test ptyNamespace functions
  it('should export ptyNamespace object', () => {
    const ptyNS = require('./socket/ptyNamespace.js');
    expect(ptyNS).toBeDefined();
  });
  
  it('should have findShellExecutable function', () => {
    const ptyNS = require('./socket/ptyNamespace.js');
    expect(typeof ptyNS.findShellExecutable).toBe('function');
  });
});
