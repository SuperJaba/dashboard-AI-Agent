import { describe, it, expect } from 'vitest';
import { isDbConnectionOrAuthError } from './db.js';

describe('isDbConnectionOrAuthError', () => {
  it('returns false for null or undefined errors', () => {
    expect(isDbConnectionOrAuthError(null)).toBe(false);
    expect(isDbConnectionOrAuthError(undefined)).toBe(false);
  });

  it('detects PostgreSQL 28000 (no pg_hba.conf entry)', () => {
    const err = {
      code: '28000',
      message: 'error: no pg_hba.conf entry for host "20.42.42.214", user "SebaP", database "dashboarddb", no encryption',
      routine: 'ClientAuthentication'
    };
    expect(isDbConnectionOrAuthError(err)).toBe(true);
  });

  it('detects PostgreSQL connection refusal and auth failure codes', () => {
    expect(isDbConnectionOrAuthError({ code: 'ECONNREFUSED' })).toBe(true);
    expect(isDbConnectionOrAuthError({ code: '28P01' })).toBe(true);
    expect(isDbConnectionOrAuthError({ code: 'ENOTFOUND' })).toBe(true);
    expect(isDbConnectionOrAuthError({ code: 'ETIMEDOUT' })).toBe(true);
    expect(isDbConnectionOrAuthError({ code: '3D000' })).toBe(true);
    expect(isDbConnectionOrAuthError({ code: '08006' })).toBe(true);
  });

  it('detects connection error messages by keyword', () => {
    expect(isDbConnectionOrAuthError({ message: 'ClientAuthentication failure' })).toBe(true);
    expect(isDbConnectionOrAuthError({ message: 'no encryption allowed' })).toBe(true);
    expect(isDbConnectionOrAuthError({ message: 'Connection terminated unexpectedly' })).toBe(true);
    expect(isDbConnectionOrAuthError({ message: 'SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string' })).toBe(true);
  });

  it('returns false for ordinary query syntax errors', () => {
    expect(isDbConnectionOrAuthError({ code: '42601', message: 'syntax error at or near "SELECT"' })).toBe(false);
  });
});
