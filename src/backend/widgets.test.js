// widgets.test.js - Test file for widgets module
import { describe, it, expect } from 'vitest';

describe('widgetsRepository', () => {
  // Test repository functions
  it('should export widgetsRepository object', () => {
    const widgetsRepo = require('./widgets/widgetsRepository.js');
    expect(widgetsRepo).toBeDefined();
  });
  
  it('should have getWidgets function', () => {
    const widgetsRepo = require('./widgets/widgetsRepository.js');
    expect(typeof widgetsRepo.getWidgets).toBe('function');
  });
  
  it('should have createWidget function', () => {
    const widgetsRepo = require('./widgets/widgetsRepository.js');
    expect(typeof widgetsRepo.createWidget).toBe('function');
  });
  
  it('should have deleteWidget function', () => {
    const widgetsRepo = require('./widgets/widgetsRepository.js');
    expect(typeof widgetsRepo.deleteWidget).toBe('function');
  });
});
