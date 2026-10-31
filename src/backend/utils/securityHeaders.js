/**
 * Security headers middleware implementing defensive baseline:
 * - Content-Security-Policy (CSP) restricting script, style, frame and connection sources
 * - Strict-Transport-Security (HSTS) enforcing HTTPS transport
 * - Prevents MIME-type sniffing (X-Content-Type-Options)
 * - Restricts clickjacking via iframe (X-Frame-Options)
 * - Modern XSS protection setting (X-XSS-Protection)
 * - Safe referrer leakage control (Referrer-Policy)
 * - Disables sensitive browser APIs (Permissions-Policy)
 * - Isolates browsing context (Cross-Origin-Opener-Policy)
 */
export function securityHeadersMiddleware(req, res, next) {
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https: blob:",
    "font-src 'self' data: https:",
    "connect-src 'self' ws: wss: http: https:",
    "frame-ancestors 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; ');

  res.setHeader('Content-Security-Policy', cspDirectives);
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '0');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  next();
}
