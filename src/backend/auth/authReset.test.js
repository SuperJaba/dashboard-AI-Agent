import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { authRouter } from './authRouter.js';

describe('POST /api/auth/reset (SEC-02)', () => {
  const originalEnv = { ...process.env };
  let app;

  beforeEach(() => {
    process.env = { ...originalEnv };
    app = express();
    app.use(express.json());
    app.use('/api/auth', authRouter);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('blocks reset in production mode with 403 Forbidden', async () => {
    process.env.NODE_ENV = 'production';
    const res = await request(app).post('/api/auth/reset');
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/zablokowane w środowisku produkcyjnym/);
  });

  it('allows reset in test or dev mode', async () => {
    process.env.NODE_ENV = 'test';
    const res = await request(app).post('/api/auth/reset');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
