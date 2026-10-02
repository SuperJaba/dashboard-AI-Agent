import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { kpiRouter } from './kpiRouter.js';

describe('kpiRouter', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/analytics', kpiRouter);

  it('GET /api/analytics/kpi returns structured KPI metrics', async () => {
    const res = await request(app).get('/api/analytics/kpi');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('today');
    expect(res.body).toHaveProperty('sevenDays');
    expect(res.body).toHaveProperty('thirtyDays');
    expect(res.body).toHaveProperty('topErrors');
    expect(res.body).toHaveProperty('tokenBurn');
  });

  it('contains expected numeric fields in today bucket', async () => {
    const res = await request(app).get('/api/analytics/kpi');
    expect(typeof res.body.today.tasks).toBe('number');
    expect(typeof res.body.today.successRate).toBe('number');
    expect(typeof res.body.today.avgDuration).toBe('number');
  });

  it('contains token burn statistics for today and week', async () => {
    const res = await request(app).get('/api/analytics/kpi');
    expect(typeof res.body.tokenBurn.today).toBe('number');
    expect(typeof res.body.tokenBurn.week).toBe('number');
    expect(res.body.tokenBurn.today).toBeGreaterThanOrEqual(0);
  });

  it('serves cached responses on consecutive requests', async () => {
    const res1 = await request(app).get('/api/analytics/kpi');
    const res2 = await request(app).get('/api/analytics/kpi');
    expect(res1.body).toEqual(res2.body);
  });

  it('topErrors is an array of error frequency objects', async () => {
    const res = await request(app).get('/api/analytics/kpi');
    expect(Array.isArray(res.body.topErrors)).toBe(true);
    if (res.body.topErrors.length > 0) {
      expect(res.body.topErrors[0]).toHaveProperty('error');
      expect(res.body.topErrors[0]).toHaveProperty('count');
    }
  });
});
