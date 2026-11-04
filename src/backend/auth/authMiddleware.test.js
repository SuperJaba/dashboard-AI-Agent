import { describe, it, expect, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import { authMiddleware, optionalAuthMiddleware } from './authMiddleware.js';
import { JWT_SECRET } from './jwtSecret.js';

describe('authMiddleware (SEC-08)', () => {
  const validToken = jwt.sign({ id: 1, username: 'admin' }, JWT_SECRET);

  it('authenticates user with valid Authorization Bearer header', () => {
    const req = {
      method: 'GET',
      headers: { authorization: `Bearer ${validToken}` },
      query: {}
    };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    authMiddleware(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toBeDefined();
    expect(req.user.username).toBe('admin');
  });

  it('rejects authentication when token is passed only in query string (?token=...)', () => {
    const req = {
      method: 'GET',
      headers: {},
      query: { token: validToken }
    };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    expect(next).not.toHaveBeenCalled();
  });

  it('optionalAuthMiddleware does not accept query token', () => {
    const req = {
      method: 'GET',
      headers: {},
      query: { token: validToken }
    };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    optionalAuthMiddleware(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toBeUndefined();
  });

  it('allows unauthenticated POST to /api/projects/sync-tasks for CLI agents', () => {
    const req = {
      method: 'POST',
      originalUrl: '/api/projects/sync-tasks',
      headers: {}
    };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    authMiddleware(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('allows unauthenticated POST to /api/projects/:id/sync-tasks for CLI agents', () => {
    const req = {
      method: 'POST',
      originalUrl: '/api/projects/42/sync-tasks',
      headers: {}
    };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    authMiddleware(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('allows unauthenticated GET to /api/projects/dashboard for CLI agents', () => {
    const req = {
      method: 'GET',
      originalUrl: '/api/projects/dashboard',
      headers: {}
    };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    authMiddleware(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('allows unauthenticated GET to /api/projects for CLI agents', () => {
    const req = {
      method: 'GET',
      originalUrl: '/api/projects',
      headers: {}
    };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    authMiddleware(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('still blocks unauthenticated POST to other project routes like /api/projects', () => {
    const req = {
      method: 'POST',
      originalUrl: '/api/projects',
      headers: {}
    };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    expect(next).not.toHaveBeenCalled();
  });
});
