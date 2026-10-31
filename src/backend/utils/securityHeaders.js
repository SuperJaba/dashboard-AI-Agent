/**
 * Security headers middleware implementing defensive baseline:
 * - Prevents MIME-type sniffing (X-Content-Type-Options)
 * - Restricts clickjacking via iframe (X-Frame-Options)
 * - Modern XSS protection setting (X-XSS-Protection)
 * - Safe referrer leakage control (Referrer-Policy)
 * - Disables sensitive browser APIs (Permissions-Policy)
 * - Isolates browsing context (Cross-Origin-Opener-Policy)
 */
export function securityHeadersMiddleware(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '0');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  next();
}
