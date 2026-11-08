// llm.test.js - Test file for llm module
import { describe, it, expect } from 'vitest';

describe('complexityScorer', () => {
  // Test complexityScorer exports
  it('should export complexityScorer object', () => {
    const complexityScorer = require('./llm/complexityScorer.js');
    expect(complexityScorer).toBeDefined();
  });
  
  it('should have scoreComplexity function', () => {
    const complexityScorer = require('./llm/complexityScorer.js');
    expect(typeof complexityScorer.scoreComplexity).toBe('function');
  });
});

describe('modelRouter', () => {
  // Test modelRouter exports
  it('should export modelRouter object', () => {
    const modelRouter = require('./llm/modelRouter.js');
    expect(modelRouter).toBeDefined();
  });
  
  it('should have CircuitBreaker class', () => {
    const modelRouter = require('./llm/modelRouter.js');
    expect(modelRouter.CircuitBreaker).toBeDefined();
  });
  
  it('should have localCircuitBreaker instance', () => {
    const modelRouter = require('./llm/modelRouter.js');
    expect(modelRouter.localCircuitBreaker).toBeDefined();
  });
});
