import { createHmac, timingSafeEqual } from 'crypto';

/**
 * T3.3 — HMAC-SHA256 signing utilities.
 * Header used: X-Dashboard-Signature-256: sha256=<hex>
 */

/**
 * Signs a payload string with HMAC-SHA256 and returns the hex digest.
 * @param {string} secret
 * @param {string} body - Serialised JSON string
 * @returns {string} hex HMAC-SHA256
 */
export function signPayload(secret, body) {
  return createHmac('sha256', secret).update(body, 'utf8').digest('hex');
}

/**
 * Constant-time comparison of the expected HMAC against the received signature.
 * @param {string} secret
 * @param {string} body
 * @param {string} signature - May be bare hex or "sha256=<hex>"
 * @returns {boolean}
 */
export function verifySignature(secret, body, signature) {
  const hex = signature.startsWith('sha256=') ? signature.slice(7) : signature;
  const expected = signPayload(secret, body);
  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(hex, 'hex'));
  } catch {
    return false;
  }
}
