import request from 'supertest';
import express, { Router } from 'express';
import jwt from 'jsonwebtoken';

// Mock the safeQuery function used by the router.
jest.mock('../db', () => ({
  safeQuery: jest.fn(),
}));
const { safeQuery }: any = require('../db'); // eslint-disable-line @typescript-eslint/no-var-requires

import { authRouter } from '../authRouter';

// Helper to create an express app with the router mounted.
function createApp(): Router {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  return app;
}

describe('Auth Router legacy implementation', () => {
  let app: any;
  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret-key'; // ensure deterministic token signing
    app = createApp();
  });

  test('POST /setup creates admin when no users exist', async () => {
    safeQuery.mockResolvedValueOnce({ rows: [{ count: '0' }] }); // no users
    const res = await request(app)
      .post('/api/auth/setup')
      .send({ username: 'admin', password: 'pass123' })
      .expect(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('token');
  });

  test('POST /setup rejects if users already exist', async () => {
    safeQuery.mockResolvedValueOnce({ rows: [{ count: '1' }] }); // user present
    const res = await request(app)
      .post('/api/auth/setup')
      .send({ username: 'admin', password: 'pass123' })
      .expect(400);
    expect(res.body).toHaveProperty('error');
  });

  test('POST /login authenticates valid credentials', async () => {
    safeQuery
      .mockResolvedValueOnce({ rows: [{ id: 42, password_hash: '$2b$10$dummyhash' }]) // select user
      .mockResolvedValueOnce({}); // dummy insert if needed
    // Mock bcrypt compare to return true
    jest.spyOn(require('bcrypt'), 'compare').mockImplementation(() => Promise.resolve(true));

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'pass123' })
      .expect(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('token');
  });

  test('POST /login fails with incorrect credentials', async () => {
    safeQuery.mockResolvedValueOnce({ rows: [] }); // no such user
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'wrong' })
      .expect(401);
    expect(res.body).toHaveProperty('error');
  });

  test('GET /check-setup reports needsSetup correctly', async () => {
    safeQuery.mockResolvedValueOnce({ rows: [{ count: '0' }] }); // no users
    const res = await request(app)
      .get('/api/auth/check-setup')
      .expect(200);
    expect(res.body).toHaveProperty('needsSetup', true);
  });
});
