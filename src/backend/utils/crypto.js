import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export const DEFAULT_FALLBACK_ENCRYPTION_KEY = 'fallback-super-secret-encryption-key-32chars!';
export const MIN_ENCRYPTION_KEY_LENGTH = 32;
const IV_LENGTH = 16;

/**
 * Validates and retrieves the encryption key.
 * In production (NODE_ENV === 'production'):
 * - Throws an error / exits if ENCRYPTION_KEY is unset, empty, or equals fallback.
 * - Enforces minimum key length of 32 characters.
 * - Prevents generating an ephemeral random key which causes data loss across restarts.
 *
 * @param {boolean} exitOnFailure
 * @returns {string}
 */
export function getEncryptionKey(exitOnFailure = true) {
  const key = process.env.ENCRYPTION_KEY;
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    if (!key || key === DEFAULT_FALLBACK_ENCRYPTION_KEY) {
      const msg = 'ENCRYPTION_KEY must be set and cannot be default fallback in production';
      console.error(`[CRYPTO CRITICAL] ${msg}`);
      if (exitOnFailure && typeof process.exit === 'function' && !process.env.VITEST) {
        process.exit(1);
      }
      throw new Error(msg);
    }
    if (key.length < MIN_ENCRYPTION_KEY_LENGTH) {
      const msg = `ENCRYPTION_KEY must be at least ${MIN_ENCRYPTION_KEY_LENGTH} characters in production (currently ${key.length})`;
      console.error(`[CRYPTO CRITICAL] ${msg}`);
      if (exitOnFailure && typeof process.exit === 'function' && !process.env.VITEST) {
        process.exit(1);
      }
      throw new Error(msg);
    }
    return key;
  }

  return key || DEFAULT_FALLBACK_ENCRYPTION_KEY;
}

export const ENCRYPTION_KEY = getEncryptionKey();

export function encrypt(text) {
  if (!text) {return text;}
  const key = getEncryptionKey(false);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key.slice(0, 32)), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

export function decrypt(text) {
  if (!text) {return text;}
  const textParts = text.split(':');
  const iv = Buffer.from(textParts.shift(), 'hex');
  const encryptedText = Buffer.from(textParts.join(':'), 'hex');
  const key = getEncryptionKey(false);
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key.slice(0, 32)), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}
