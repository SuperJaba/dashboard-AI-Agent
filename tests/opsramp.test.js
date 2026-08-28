import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import app from '../server.js';
import jwt from 'jsonwebtoken';

vi.mock('pg', () => {
  const mPool = {
    query: vi.fn().mockResolvedValue({ rows: [] })
  };
  class Pool {
    constructor() { return mPool; }
  }
  return { default: { Pool } };
});

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-super-secret-key-123';
const testToken = jwt.sign({ id: 1, username: 'testuser' }, JWT_SECRET, { expiresIn: '1h' });

describe('OpsRamp API Routes', () => {
  it('GET /api/opsramp/status should return gateway and AIOps status', async () => {
    const res = await request(app)
      .get('/api/opsramp/status')
      .set('Authorization', `Bearer ${testToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.enabled).toBe(true);
    expect(res.body.tenant).toBeDefined();
    expect(res.body.gateway).toBeDefined();
    expect(res.body.aiops).toBeDefined();
    expect(res.body.aiops.noiseReductionRate).toBeGreaterThan(50);
  });

  it('GET /api/opsramp/alerts should return list of alerts', async () => {
    const res = await request(app)
      .get('/api/opsramp/alerts')
      .set('Authorization', `Bearer ${testToken}`);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.alerts)).toBe(true);
    expect(res.body.alerts.length).toBeGreaterThan(0);
  });

  it('GET /api/opsramp/resources should return monitored Docker infrastructure', async () => {
    const res = await request(app)
      .get('/api/opsramp/resources')
      .set('Authorization', `Bearer ${testToken}`);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.resources)).toBe(true);
    expect(res.body.resources.some((r) => r.name.includes('postgres'))).toBe(true);
  });

  it('POST /api/opsramp/simulate-alert should inject a new incident', async () => {
    const res = await request(app)
      .post('/api/opsramp/simulate-alert')
      .set('Authorization', `Bearer ${testToken}`)
      .send({
        subject: 'Custom Test Anomaly',
        resource: 'test-container',
        severity: 'warning'
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.alert.subject).toBe('Custom Test Anomaly');
  });

  it('POST /api/opsramp/alerts/:id/ack should acknowledge an alert', async () => {
    const res = await request(app)
      .post('/api/opsramp/alerts/OPS-1094/acknowledge')
      .set('Authorization', `Bearer ${testToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.alert.state).toBe('acknowledged');
  });
});
