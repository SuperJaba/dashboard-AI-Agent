import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock crypto.js at the top level to avoid runtime errors during testing
vi.mock('./crypto.js', () => ({
  decrypt: vi.fn((text) => {
    if (!text) return text;
    // Return a valid hex string that decrypt() can process (IV + encrypted data)
    // Format: iv_hex:encrypted_data_hex
    const fakeIv = '0123456789abcdef'; // 16 bytes as hex
    const fakeEncrypted = 'deadbeefcafebabe1234567890abcdef'; // valid hex data
    return fakeIv + ':' + fakeEncrypted;
  })
}));

import { sshCmd } from './ssh.js';

describe('sshCmd function (SEC-07)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('generates correct SSH command with ssh_password and port, username, host', () => {
    const s = {
      ssh_password: 'encrypted-password-here',
      username: 'user',
      host: 'example.com',
      port: 22
    };

    const result = sshCmd(s, 'uptime');

    // The decrypted password is IV + encrypted data format
    expect(result).toContain('sshpass -p "0123456789abcdef:deadbeefcafebabe1234567890abcdef"');
    expect(result).toContain('-p 22');
    expect(result).toContain('user@example.com');
    expect(result).toContain('uptime');
  });

  it('generates correct SSH command with key authentication when no ssh_password', () => {
    const s = {
      username: 'user',
      host: 'example.com',
      port: 22
    };

    const result = sshCmd(s, 'uptime');

    expect(result).toContain('-i ~/.ssh/id_ed25519_antigravity');
    expect(result).toContain('-i ~/.ssh/id_rsa');
    expect(result).toContain('-p 22');
    expect(result).toContain('user@example.com');
    expect(result).toContain('uptime');
  });

  it('handles null ssh_password correctly', () => {
    const s = {
      ssh_password: null,
      username: 'user',
      host: 'example.com',
      port: 22
    };

    const result = sshCmd(s, 'uptime');

    expect(result).toContain('-i ~/.ssh/id_ed25519_antigravity');
    expect(result).toContain('-i ~/.ssh/id_rsa');
    expect(result).toContain('user@example.com');
  });

  it('handles empty string ssh_password correctly', () => {
    const s = {
      ssh_password: '',
      username: 'user',
      host: 'example.com',
      port: 22
    };

    const result = sshCmd(s, 'uptime');

    expect(result).toContain('-i ~/.ssh/id_ed25519_antigravity');
    expect(result).toContain('user@example.com');
  });

  it('handles remoteCmd parameter correctly', () => {
    const s = {
      ssh_password: 'encrypted-password-here',
      username: 'user',
      host: 'example.com',
      port: 2222
    };

    const result = sshCmd(s, 'custom-command');

    expect(result).toContain('custom-command');
    expect(result).toContain('-p 2222');
  });

  it('handles missing remoteCmd parameter correctly', () => {
    const s = {
      ssh_password: 'encrypted-password-here',
      username: 'user',
      host: 'example.com',
      port: 22
    };

    const result = sshCmd(s);

    expect(result).not.toContain('undefined');
    // The decrypted password is IV + encrypted data format
    expect(result).toContain('sshpass -p "0123456789abcdef:deadbeefcafebabe1234567890abcdef"');
    expect(result).toContain('user@example.com');
  });

  it('handles no ssh_password and no remoteCmd correctly', () => {
    const s = {
      username: 'user',
      host: 'example.com',
      port: 22
    };

    const result = sshCmd(s);

    expect(result).toContain('-i ~/.ssh/id_ed25519_antigravity');
    expect(result).not.toContain('undefined');
    expect(result).toContain('user@example.com');
  });
});
