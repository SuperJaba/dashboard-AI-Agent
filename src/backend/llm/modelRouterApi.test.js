import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { modelRouterApi } from './modelRouterApi.js';
import { resetRoutingStats, recordRoutingCall } from './modelRouter.js';

describe('modelRouterApi Endpoints', () => {
  let app;

  beforeEach(() => {
    resetRoutingStats();
    app = express();
    app.use(express.json());
    app.use('/api/llm', modelRouterApi);
  });

  it('GET /api/llm/routing-stats returns baseline routing stats', async () => {
    const res = await request(app).get('/api/llm/routing-stats');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('localTasks', 0);
    expect(res.body).toHaveProperty('cloudTasks', 0);
    expect(res.body).toHaveProperty('circuitBreakerState', 'CLOSED');
    expect(res.body).toHaveProperty('primaryLocalModel');
    expect(res.body).toHaveProperty('fallbackLocalModel');
    expect(res.body).toHaveProperty('cloudModel');
  });

  it('POST /api/llm/record-call increments task counts and updates averages', async () => {
    await request(app)
      .post('/api/llm/record-call')
      .send({
        tier: 'low',
        provider: 'lm-studio',
        model: 'openai/gpt-oss-20b',
        durationMs: 320,
        success: true,
        promptPreview: 'List files in workspace'
      });

    await request(app)
      .post('/api/llm/record-call')
      .send({
        tier: 'high',
        provider: 'agy',
        model: 'agy-gemini-pro',
        durationMs: 1400,
        success: true,
        promptPreview: 'Refactor database architecture'
      });

    const statsRes = await request(app).get('/api/llm/routing-stats');
    expect(statsRes.status).toBe(200);
    expect(statsRes.body.localTasks).toBe(1);
    expect(statsRes.body.cloudTasks).toBe(1);
    expect(statsRes.body.avgLocalLatencyMs).toBe(320);
    expect(statsRes.body.avgCloudLatencyMs).toBe(1400);
    expect(statsRes.body.recentCalls).toHaveLength(2);
  });

  it('POST /api/llm/route-prompt with dryRun evaluates complexity without external call', async () => {
    const res = await request(app)
      .post('/api/llm/route-prompt')
      .send({
        prompt: 'Formatuj ten tekst json',
        dryRun: true
      });

    expect(res.status).toBe(200);
    expect(res.body.dryRun).toBe(true);
    expect(res.body.route.tier).toBe('low');
    expect(res.body.route.provider).toBe('lm-studio');
  });

  it('POST /api/llm/route-prompt with dryRun identifies complex tasks as cloud', async () => {
    const res = await request(app)
      .post('/api/llm/route-prompt')
      .send({
        prompt: 'Zaprojektuj rozproszoną architekturę mikroserwisów i usuń deadlock transakcji',
        dryRun: true
      });

    expect(res.status).toBe(200);
    expect(res.body.dryRun).toBe(true);
    expect(res.body.route.tier).toBe('high');
    expect(res.body.route.provider).toBe('agy');
  });

  it('POST /api/llm/reset-stats resets all metrics to zero', async () => {
    recordRoutingCall({ tier: 'low', provider: 'lm-studio', durationMs: 200 });
    const resetRes = await request(app).post('/api/llm/reset-stats');
    expect(resetRes.status).toBe(200);
    expect(resetRes.body.stats.localTasks).toBe(0);
    expect(resetRes.body.stats.cloudTasks).toBe(0);
  });
});
