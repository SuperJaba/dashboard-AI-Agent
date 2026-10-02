import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getJwtSecret, DEFAULT_FALLBACK_SECRET, MIN_JWT_SECRET_LENGTH } from './jwtSecret.js';

describe('JWT Secret Resolution and Validation', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('allows fallback key in non-production environments when JWT_SECRET is unset', () => {
    delete process.env.JWT_SECRET;
    process.env.NODE_ENV = 'development';
    expect(getJwtSecret()).toBe(DEFAULT_FALLBACK_SECRET);
  });

  it('uses configured JWT_SECRET in development', () => {
    process.env.JWT_SECRET = 'my-development-secret-key';
    process.env.NODE_ENV = 'development';
    expect(getJwtSecret()).toBe('my-development-secret-key');
  });

  it('throws in production when JWT_SECRET is unset', () => {
    delete process.env.JWT_SECRET;
    process.env.NODE_ENV = 'production';
    expect(() => getJwtSecret()).toThrow(/JWT_SECRET must be set/i);
  });

  it('throws in production when JWT_SECRET is set to the default fallback key', () => {
    process.env.JWT_SECRET = DEFAULT_FALLBACK_SECRET;
    process.env.NODE_ENV = 'production';
    expect(() => getJwtSecret()).toThrow(/cannot be default fallback/i);
  });

  it('throws in production when JWT_SECRET is shorter than 32 characters', () => {
    process.env.JWT_SECRET = 'too-short-secret-123';
    process.env.NODE_ENV = 'production';
    expect(() => getJwtSecret()).toThrow(new RegExp(`at least ${MIN_JWT_SECRET_LENGTH} characters`, 'i'));
  });

  it('succeeds in production when JWT_SECRET is strong and >= 32 characters', () => {
    const strongSecret = 'a-very-strong-production-jwt-secret-key-1234567890';
    process.env.JWT_SECRET = strongSecret;
    process.env.NODE_ENV = 'production';
    expect(getJwtSecret()).toBe(strongSecret);
  });
});
