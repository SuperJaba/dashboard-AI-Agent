// webhooks.test.js - Test file for webhooks module
import { describe, it, expect } from 'vitest';

describe('signature', () => {
  // Test signature functions
  it('should export signature object', () => {
    const signature = require('./webhooks/signature.js');
    expect(signature).toBeDefined();
  });
  
  it('should have signPayload function', () => {
    const signature = require('./webhooks/signature.js');
    expect(typeof signature.signPayload).toBe('function');
  });
});

describe('webhookDispatcher', () => {
  // Test webhookDispatcher functions
  it('should export webhookDispatcher object', () => {
    const webhookDispatcher = require('./webhooks/webhookDispatcher.js');
    expect(webhookDispatcher).toBeDefined();
  });
  
  it('should have attemptDelivery function', () => {
    const webhookDispatcher = require('./webhooks/webhookDispatcher.js');
    expect(typeof webhookDispatcher.attemptDelivery).toBe('function');
  });
});

describe('webhookRepository', () => {
  // Test webhookRepository functions
  it('should export webhookRepository object', () => {
    const webhookRepo = require('./webhooks/webhookRepository.js');
    expect(webhookRepo).toBeDefined();
  });
  
  it('should have create function', () => {
    const webhookRepo = require('./webhooks/webhookRepository.js');
    expect(typeof webhookRepo.create).toBe('function');
  });
});
