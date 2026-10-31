import { describe, it, expect, vi } from 'vitest';
import { securityHeadersMiddleware } from './securityHeaders.js';

describe('securityHeadersMiddleware', () => {
  it('sets defensive security headers on the response', () => {
    const headers = {};
    const res = {
      setHeader: vi.fn((key, val) => {
        headers[key] = val;
      })
    };
    const req = {};
    const next = vi.fn();

    securityHeadersMiddleware(req, res, next);

    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['X-Frame-Options']).toBe('SAMEORIGIN');
    expect(headers['X-XSS-Protection']).toBe('0');
    expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['Permissions-Policy']).toBe('camera=(), microphone=(), geolocation=()');
    expect(headers['Cross-Origin-Opener-Policy']).toBe('same-origin');
    expect(next).toHaveBeenCalledOnce();
  });
});
