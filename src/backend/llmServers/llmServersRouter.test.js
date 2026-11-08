import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { llmServersRouter } from './llmServersRouter.js';
import { localCircuitBreaker } from '../llm/modelRouter.js';

describe('llmServersRouter - Model Routing Stats', () => {
  const app = express();
  app.use(express.json());
  app.use('/api', llmServersRouter);

  beforeEach(() => {
    localCircuitBreaker.reset();
  });

  it('GET /api/llm/routing/stats returns current routing stats and breaker status', async () => {
    const res = await request(app).get('/api/llm/routing/stats');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('circuitBreakerState', 'CLOSED');
    expect(res.body).toHaveProperty('primaryLocalModel');
    expect(res.body).toHaveProperty('fallbackLocalModel');
    expect(res.body).toHaveProperty('avgLocalLatencyMs');
    expect(res.body).toHaveProperty('avgCloudLatencyMs');
  });

  it('POST /api/llm/routing/circuit/reset successfully resets circuit breaker', async () => {
    localCircuitBreaker.recordFailure();
    localCircuitBreaker.recordFailure();
    localCircuitBreaker.recordFailure();
    expect(localCircuitBreaker.state).toBe('OPEN');

    const res = await request(app).post('/api/llm/routing/circuit/reset');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.stats.circuitBreakerState).toBe('CLOSED');
    expect(localCircuitBreaker.state).toBe('CLOSED');
  });
});
