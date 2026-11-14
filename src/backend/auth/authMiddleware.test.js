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

  it('allows query string token for SSE endpoint /api/events', () => {
    const req = {
      method: 'GET',
      originalUrl: '/api/events?token=' + validToken,
      url: '/api/events?token=' + validToken,
      headers: { accept: 'text/event-stream' },
      query: { token: validToken }
    };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    authMiddleware(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toBeDefined();
    expect(req.user.username).toBe('admin');
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

  it('allows unauthenticated PUT to /api/projects/:id/tasks for CLI agents', () => {
    const req = {
      method: 'PUT',
      originalUrl: '/api/projects/dashboard/tasks',
      headers: {}
    };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    authMiddleware(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('allows unauthenticated PATCH to /api/projects/:id/tasks/:taskId for CLI agents', () => {
    const req = {
      method: 'PATCH',
      originalUrl: '/api/projects/1/tasks/10',
      headers: {}
    };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    authMiddleware(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('allows unauthenticated POST to /api/projects/:id/tasks for CLI agents', () => {
    const req = {
      method: 'POST',
      originalUrl: '/api/projects/dashboard/tasks',
      headers: {}
    };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    authMiddleware(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('allows unauthenticated POST to /api/projects/:id/analyze for CLI agents', () => {
    const req = {
      method: 'POST',
      originalUrl: '/api/projects/dashboard/analyze',
      headers: {}
    };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    authMiddleware(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('allows unauthenticated POST to /api/llm/record-call and route-prompt for CLI agents', () => {
    const req = {
      method: 'POST',
      originalUrl: '/api/llm/record-call',
      headers: {}
    };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    authMiddleware(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('allows unauthenticated POST to /api/llm-proxy for CLI agents passing upstream keys', () => {
    const req = {
      method: 'POST',
      originalUrl: '/api/llm-proxy/chat/completions',
      headers: { authorization: 'Bearer sk-upstream-key' }
    };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    authMiddleware(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('allows query string token when it is a signed agent token (?token=... with isAgent: true)', () => {
    const agentToken = jwt.sign({ id: 1, username: 'agent-runner', isAgent: true }, JWT_SECRET, { expiresIn: '1h' });
    const req = {
      method: 'GET',
      originalUrl: '/api/servers',
      query: { token: agentToken },
      headers: {}
    };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    authMiddleware(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toBeDefined();
    expect(req.user.isAgent).toBe(true);
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
