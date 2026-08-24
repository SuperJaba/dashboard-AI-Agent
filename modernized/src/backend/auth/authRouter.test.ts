import { describe, test, expect, beforeAll, afterEach, vi } from 'vitest';
import request from 'supertest';
import express, { Router } from 'express';

// Mock the safeQuery function used by the real legacy router.
vi.mock('../../../../src/backend/db.js', () => ({
  safeQuery: vi.fn(),
}));
import { safeQuery } from '../../../../src/backend/db.js';

let authRouter: Router;

// Helper to create an express app with the router mounted.
function createApp(): Router {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  return app;
}

describe('Auth Router legacy implementation', () => {
  let app: any;
  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret-key'; // ensure deterministic token signing
    // Import after JWT_SECRET is set: authRouter.js reads it once at module
    // load time into a top-level constant.
    ({ authRouter } = await import('../../../../src/backend/auth/authRouter.js'));
    app = createApp();
  });

  afterEach(() => {
    // resetAllMocks (not clearAllMocks) also drops any leftover queued
    // mockResolvedValueOnce values so they don't leak into the next test.
    vi.resetAllMocks();
  });

  test('POST /setup creates admin when no users exist', async () => {
    (safeQuery as any)
      .mockResolvedValueOnce({ rows: [{ count: '0' }] }) // no users
      .mockResolvedValueOnce({ rows: [{ id: 1 }] }); // insert admin
    const res = await request(app)
      .post('/api/auth/setup')
      .send({ username: 'admin', password: 'pass123' })
      .expect(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('token');
  });

  test('POST /setup rejects if users already exist', async () => {
    (safeQuery as any).mockResolvedValueOnce({ rows: [{ count: '1' }] }); // user present
    const res = await request(app)
      .post('/api/auth/setup')
      .send({ username: 'admin', password: 'pass123' })
      .expect(400);
    expect(res.body).toHaveProperty('error');
  });

  test('POST /login authenticates valid credentials', async () => {
    (safeQuery as any)
      .mockResolvedValueOnce({ rows: [{ id: 42, password_hash: '$2b$10$dummyhash' }] }) // select user
      .mockResolvedValueOnce({}); // dummy insert if needed
    // Mock bcrypt compare to return true
    const bcrypt = await import('bcrypt');
    vi.spyOn(bcrypt.default, 'compare').mockImplementation(() => Promise.resolve(true) as any);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'pass123' })
      .expect(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('token');
  });

  test('POST /login fails with incorrect credentials', async () => {
    (safeQuery as any).mockResolvedValueOnce({ rows: [] }); // no such user
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'wrong' })
      .expect(401);
    expect(res.body).toHaveProperty('error');
  });

  test('GET /check-setup reports needsSetup correctly', async () => {
    (safeQuery as any).mockResolvedValueOnce({ rows: [{ count: '0' }] }); // no users
    const res = await request(app)
      .get('/api/auth/check-setup')
      .expect(200);
    expect(res.body).toHaveProperty('needsSetup', true);
  });
});
