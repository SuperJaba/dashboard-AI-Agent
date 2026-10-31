import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getAllowedOrigins, corsOriginDelegate } from './corsConfig.js';

describe('CORS configuration (SEC-06)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('allows same-origin or tool requests with no Origin header', () => {
    const cb = vi.fn();
    corsOriginDelegate(undefined, cb);
    expect(cb).toHaveBeenCalledWith(null, true);
  });

  it('allows whitelisted domains (localhost and production ct8 domain)', () => {
    const cb = vi.fn();
    corsOriginDelegate('http://localhost:5173', cb);
    expect(cb).toHaveBeenCalledWith(null, true);

    const cbProd = vi.fn();
    corsOriginDelegate('https://dashboard.jagger2.ct8.pl', cbProd);
    expect(cbProd).toHaveBeenCalledWith(null, true);
  });

  it('allows extra origins configured via ALLOWED_ORIGINS env var', () => {
    process.env.ALLOWED_ORIGINS = 'https://custom-domain.example.com, https://another.com';
    const origins = getAllowedOrigins();
    expect(origins).toContain('https://custom-domain.example.com');
    expect(origins).toContain('https://another.com');

    const cb = vi.fn();
    corsOriginDelegate('https://custom-domain.example.com', cb);
    expect(cb).toHaveBeenCalledWith(null, true);
  });

  it('rejects unauthorized foreign origins', () => {
    delete process.env.ALLOWED_ORIGINS;
    const cb = vi.fn();
    corsOriginDelegate('https://malicious-attacker.evil.com', cb);
    expect(cb).toHaveBeenCalledWith(null, false);
  });
});
