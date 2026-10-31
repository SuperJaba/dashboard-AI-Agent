import { describe, it, expect, vi } from 'vitest';
import { securityHeadersMiddleware } from './securityHeaders.js';

describe('securityHeadersMiddleware (SEC-05)', () => {
  it('sets defensive security headers including CSP and HSTS', () => {
    const headers = {};
    const res = {
      setHeader: vi.fn((key, val) => {
        headers[key] = val;
      })
    };
    const req = {};
    const next = vi.fn();

    securityHeadersMiddleware(req, res, next);

    expect(headers['Content-Security-Policy']).toBeDefined();
    expect(headers['Content-Security-Policy']).toContain("default-src 'self'");
    expect(headers['Content-Security-Policy']).toContain("frame-ancestors 'self'");
    expect(headers['Content-Security-Policy']).toContain("object-src 'none'");

    expect(headers['Strict-Transport-Security']).toBe('max-age=31536000; includeSubDomains');
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['X-Frame-Options']).toBe('SAMEORIGIN');
    expect(headers['X-XSS-Protection']).toBe('0');
    expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['Permissions-Policy']).toBe('camera=(), microphone=(), geolocation=()');
    expect(headers['Cross-Origin-Opener-Policy']).toBe('same-origin');
    expect(next).toHaveBeenCalledOnce();
  });
});
