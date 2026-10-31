import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  encrypt,
  decrypt,
  getEncryptionKey,
  DEFAULT_FALLBACK_ENCRYPTION_KEY,
  MIN_ENCRYPTION_KEY_LENGTH
} from './crypto.js';

describe('crypto service (SEC-07)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('encrypts and decrypts text successfully', () => {
    const plain = 'super-secret-password-1234';
    const encrypted = encrypt(plain);
    expect(encrypted).not.toBe(plain);
    expect(encrypted).toContain(':');

    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plain);
  });

  it('handles null and empty input gracefully', () => {
    expect(encrypt('')).toBe('');
    expect(encrypt(null)).toBe(null);
    expect(decrypt('')).toBe('');
    expect(decrypt(null)).toBe(null);
  });

  it('uses fallback key when ENCRYPTION_KEY is unset in non-production', () => {
    delete process.env.ENCRYPTION_KEY;
    process.env.NODE_ENV = 'development';
    const key = getEncryptionKey(false);
    expect(key).toBe(DEFAULT_FALLBACK_ENCRYPTION_KEY);
  });

  it('throws an error in production if ENCRYPTION_KEY is missing or fallback', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ENCRYPTION_KEY;
    expect(() => getEncryptionKey(false)).toThrow(/ENCRYPTION_KEY must be set/);

    process.env.ENCRYPTION_KEY = DEFAULT_FALLBACK_ENCRYPTION_KEY;
    expect(() => getEncryptionKey(false)).toThrow(/cannot be default fallback/);
  });

  it('throws an error in production if ENCRYPTION_KEY is too short (< 32 chars)', () => {
    process.env.NODE_ENV = 'production';
    process.env.ENCRYPTION_KEY = 'short-key';
    expect(() => getEncryptionKey(false)).toThrow(new RegExp(`at least ${MIN_ENCRYPTION_KEY_LENGTH} characters`));
  });

  it('accepts valid 32+ character ENCRYPTION_KEY in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.ENCRYPTION_KEY = '12345678901234567890123456789012'; // 32 chars
    expect(getEncryptionKey(false)).toBe('12345678901234567890123456789012');
  });
});
