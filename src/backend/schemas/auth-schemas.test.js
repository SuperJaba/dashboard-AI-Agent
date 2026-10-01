import { describe, it, expect } from 'vitest';
import { loginSchema, setupSchema, refreshSchema } from './authSchemas.js';
import { validate } from './validate.js';

describe('authSchemas', () => {
  describe('loginSchema', () => {
    it('accepts valid credentials', () => {
      const result = loginSchema.safeParse({ username: 'admin', password: 'secret123' });
      expect(result.success).toBe(true);
    });

    it('rejects empty username', () => {
      const result = loginSchema.safeParse({ username: '', password: 'secret123' });
      expect(result.success).toBe(false);
    });

    it('rejects missing password', () => {
      const result = loginSchema.safeParse({ username: 'admin' });
      expect(result.success).toBe(false);
    });
  });

  describe('setupSchema', () => {
    it('accepts valid setup payload', () => {
      const result = setupSchema.safeParse({ username: 'admin', password: 'securepass1' });
      expect(result.success).toBe(true);
    });

    it('rejects username shorter than 3 chars', () => {
      const result = setupSchema.safeParse({ username: 'ab', password: 'securepass1' });
      expect(result.success).toBe(false);
    });

    it('rejects password shorter than 8 chars', () => {
      const result = setupSchema.safeParse({ username: 'admin', password: 'short' });
      expect(result.success).toBe(false);
    });
  });

  describe('refreshSchema', () => {
    it('accepts body with token', () => {
      const result = refreshSchema.safeParse({ token: 'some.jwt.token' });
      expect(result.success).toBe(true);
    });

    it('accepts empty body (token optional)', () => {
      const result = refreshSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });
});

describe('validate middleware', () => {
  it('calls next() on valid body and strips unknown fields', () => {
    const schema = loginSchema;
    const middleware = validate(schema);
    const req = { body: { username: 'admin', password: 'secret123', extra: 'ignored' } };
    const res = {};
    let nextCalled = false;
    middleware(req, res, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
    // Zod strips unknown keys
    expect(req.body.extra).toBeUndefined();
  });

  it('returns 400 on invalid body', () => {
    const schema = loginSchema;
    const middleware = validate(schema);
    const req = { body: { username: '' } };
    const statusCalls = [];
    const jsonCalls = [];
    const res = {
      status: (code) => { statusCalls.push(code); return res; },
      json: (data) => { jsonCalls.push(data); return res; },
    };
    middleware(req, res, () => {});
    expect(statusCalls).toContain(400);
    expect(jsonCalls[0]).toHaveProperty('errors');
  });
});
