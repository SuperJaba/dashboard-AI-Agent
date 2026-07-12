import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from './server.js';

vi.mock('child_process', async (importOriginal) => {
  const mod = await importOriginal();
  const mockedExec = vi.fn((cmd, cb) => cb(null, '/mocked/path\n', ''));
  const mockedSpawn = vi.fn(() => ({ unref: vi.fn() }));
  return {
    ...mod,
    exec: mockedExec,
    spawn: mockedSpawn,
    default: {
      ...mod.default,
      exec: mockedExec,
      spawn: mockedSpawn
    }
  };
});

// Mock pg to prevent real db connections during tests
vi.mock('pg', () => {
  const mPool = {
    query: vi.fn().mockResolvedValue({ rows: [] })
  };
  class Pool {
    constructor() { return mPool; }
  }
  return { default: { Pool } };
});

import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-super-secret-key-123';
const testToken = jwt.sign({ id: 1, username: 'testuser' }, JWT_SECRET, { expiresIn: '1h' });

describe('Backend API Tests', () => {
  it('GET /api/projects should return an array', async () => {
    const res = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${testToken}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /api/pick-folder should return a mocked path', async () => {
    const res = await request(app)
      .get('/api/pick-folder')
      .set('Authorization', `Bearer ${testToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.path).toBe('/mocked/path');
  });

  it('POST /api/analyze should fail if no directory provided', async () => {
    const res = await request(app)
      .post('/api/analyze')
      .set('Authorization', `Bearer ${testToken}`)
      .send({});
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('Missing directory');
  });
});
