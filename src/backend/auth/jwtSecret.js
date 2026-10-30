import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export const DEFAULT_FALLBACK_SECRET = 'fallback-super-secret-key-123';
export const MIN_JWT_SECRET_LENGTH = 32;

/**
 * Validates and retrieves the JWT secret for the application.
 * In production (NODE_ENV === 'production'):
 * - Throws an error / exits if JWT_SECRET is unset or equals the fallback secret.
 * - Enforces minimum key length (32 characters).
 *
 * @returns {string} The validated JWT secret.
 */
export function getJwtSecret(exitOnFailure = true) {
  const secret = process.env.JWT_SECRET;
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    if (!secret || secret === DEFAULT_FALLBACK_SECRET) {
      const msg = 'JWT_SECRET must be set and cannot be default fallback in production';
      console.error(`[AUTH CRITICAL] ${msg}`);
      if (exitOnFailure && typeof process.exit === 'function' && !process.env.VITEST) {
        process.exit(1);
      }
      throw new Error(msg);
    }
    if (secret.length < MIN_JWT_SECRET_LENGTH) {
      const msg = `JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters in production (currently ${secret.length})`;
      console.error(`[AUTH CRITICAL] ${msg}`);
      if (exitOnFailure && typeof process.exit === 'function' && !process.env.VITEST) {
        process.exit(1);
      }
      throw new Error(msg);
    }
  }

  return secret || DEFAULT_FALLBACK_SECRET;
}

export const JWT_SECRET = getJwtSecret();
