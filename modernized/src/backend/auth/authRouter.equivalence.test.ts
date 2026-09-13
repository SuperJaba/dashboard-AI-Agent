import { describe, test, expect, beforeAll, afterEach, vi } from 'vitest';
import request from 'supertest';
import express, { Router } from 'express';
import jwt from 'jsonwebtoken';

vi.mock('../../../../src/backend/db.js', () => ({ safeQuery: vi.fn() })); // legacy db module
import { safeQuery } from '../../../../src/backend/db.js';
// mock bcrypt compare for login and refresh token comparisons
import bcrypt from 'bcrypt';
vi.spyOn(bcrypt, 'compare');

let authRouter: Router;

function createApp(): Router {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  return app;
}

describe('Legacy Auth Router – functional behavior', () => {
  let app: any;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret-key'; // deterministic signing key
    // Import after JWT_SECRET is set: authRouter.js reads it once at module
    // load time into a top-level constant.
    ({ authRouter } = await import('../../../../src/backend/auth/authRouter.js'));
    app = createApp();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  /*** /setup ***/
  test('POST /setup creates admin when no users exist', async () => {
    (safeQuery as any)
      .mockResolvedValueOnce({ rows: [{ count: '0' }] }) // no existing user
      .mockResolvedValueOnce({ rows: [{ id: 1 }] }); // insert admin
    const res = await request(app)
      .post('/api/auth/setup')
      .send({ username: 'admin', password: 'pass123' })
      .expect(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('token');
  });

  test('POST /setup rejects when users already exist', async () => {
    (safeQuery as any).mockResolvedValueOnce({ rows: [{ count: '1' }] }); // existing user present
    const res = await request(app)
      .post('/api/auth/setup')
      .send({ username: 'admin', password: 'pass123' })
      .expect(400);
    expect(res.body).toHaveProperty('error');
  });

  test('POST /setup returns error for missing credentials', async () => {
    const res = await request(app)
      .post('/api/auth/setup')
      .send({ username: '', password: '' })
      .expect(400);
    expect(res.body).toHaveProperty('error');
  });

  /*** /login ***/
  test('POST /login authenticates valid credentials', async () => {
    (safeQuery as any)
      .mockResolvedValueOnce({ rows: [{ id: 42, password_hash: "$2b$10$dummypass" }] }) // select user row
      .mockResolvedValueOnce({}); // dummy insert if needed (not used in login)
    (bcrypt.compare as any).mockResolvedValue(true);
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'pass123' })
      .expect(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('token');
  });

  test('POST /login fails with incorrect credentials', async () => {
    (safeQuery as any).mockResolvedValueOnce({ rows: [] }); // user not found
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'wrong' })
      .expect(401);
    expect(res.body).toHaveProperty('error');
  });

  test('POST /login returns error for missing credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: '', password: '' })
      .expect(400);
    expect(res.body).toHaveProperty('error');
  });

  /*** /check-setup ***/
  test('GET /check-setup reports needsSetup correctly', async () => {
    (safeQuery as any).mockResolvedValueOnce({ rows: [{ count: '0' }] }); // no users
    const res = await request(app)
      .get('/api/auth/check-setup')
      .expect(200);
    expect(res.body).toHaveProperty('needsSetup', true);
  });

  test('GET /check-setup indicates setup not needed when users exist', async () => {
    (safeQuery as any).mockResolvedValueOnce({ rows: [{ count: '3' }] }); // some users
    const res = await request(app)
      .get('/api/auth/check-setup')
      .expect(200);
    expect(res.body).toHaveProperty('needsSetup', false);
  });

  /*** /refresh ***/
  test('POST /refresh returns new token when valid token provided', async () => {
    const oldToken = jwt.sign({ id: 42, username: 'admin' }, process.env.JWT_SECRET!, { expiresIn: '7d' });
    (safeQuery as any)
      .mockResolvedValueOnce({ rows: [{ id: 42 }] }) // find user by decoded.username
      .mockResolvedValueOnce({}); // dummy insert if needed (not used)
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ token: oldToken })
      .expect(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('token');
  });

  test('POST /refresh fails when no token supplied', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({})
      .expect(400);
    expect(res.body).toHaveProperty('error');
  });

  test('POST /refresh fails when token is invalid', async () => {
    (safeQuery as any).mockResolvedValueOnce({ rows: [] }); // user not found after verify
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ token: 'invalidtoken' })
      .expect(401);
    expect(res.body).toHaveProperty('error');
  });

  /*** /reset ***/
  test('POST /reset deletes all users', async () => {
    (safeQuery as any).mockResolvedValueOnce({}); // delete operation success
    const res = await request(app)
      .post('/api/auth/reset')
      .send()
      .expect(200);
    expect(res.body).toHaveProperty('success', true);
  });

  /*** Error handling ***/
  test('setup returns 500 on database error', async () => {
    (safeQuery as any).mockRejectedValueOnce(new Error('db failure'));
    const res = await request(app)
      .post('/api/auth/setup')
      .send({ username: 'admin', password: 'pass123' })
      .expect(500);
    expect(res.body).toHaveProperty('error');
  });
});
