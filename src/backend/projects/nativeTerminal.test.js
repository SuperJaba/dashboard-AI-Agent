import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolveNativeTerminalCommand, buildNativeTerminalEnv } from './projectsRouter.js';

describe('resolveNativeTerminalCommand & buildNativeTerminalEnv', () => {
  const originalPlatform = process.platform;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
    process.env = { ...originalEnv };
  });

  describe('resolveNativeTerminalCommand', () => {
    it('returns Darwin Terminal configuration on macOS', () => {
      Object.defineProperty(process, 'platform', { value: 'darwin' });
      const res = resolveNativeTerminalCommand('/test/script.sh', '/test/dir');
      expect(res.command).toBe('open');
      expect(res.args).toEqual(['-a', 'Terminal', '/test/script.sh']);
    });

    it('returns Windows cmd / git-bash configuration on win32', () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      const res = resolveNativeTerminalCommand('C:\\test\\script.sh', 'C:\\test\\dir');
      expect(res.command).toBe('cmd.exe');
      expect(res.args[0]).toBe('/c');
      expect(res.args[1]).toBe('start');
    });

    it('resolves konsole or valid linux terminal on linux', () => {
      Object.defineProperty(process, 'platform', { value: 'linux' });
      process.env.XDG_CURRENT_DESKTOP = 'KDE';
      const res = resolveNativeTerminalCommand('/test/script.sh', '/test/dir');
      expect(typeof res.command).toBe('string');
      expect(Array.isArray(res.args)).toBe(true);
      expect(res.args).toContain('/test/script.sh');
    });
  });

  describe('buildNativeTerminalEnv', () => {
    it('merges process.env and agent environment variables', () => {
      const agentEnv = {
        ANTHROPIC_API_KEY: 'test-api-key',
        ANTHROPIC_MODEL: 'test-model'
      };
      const builtEnv = buildNativeTerminalEnv(agentEnv);

      expect(builtEnv.ANTHROPIC_API_KEY).toBe('test-api-key');
      expect(builtEnv.ANTHROPIC_MODEL).toBe('test-model');
      expect(builtEnv.PATH).toBeDefined();
    });

    it('preserves DISPLAY and user runtime variables needed for GUI on Linux', () => {
      process.env.DISPLAY = ':1';
      process.env.WAYLAND_DISPLAY = 'wayland-1';
      process.env.XDG_RUNTIME_DIR = '/run/user/1000';

      const builtEnv = buildNativeTerminalEnv({ CUSTOM_VAR: 'val' });
      expect(builtEnv.DISPLAY).toBe(':1');
      expect(builtEnv.WAYLAND_DISPLAY).toBe('wayland-1');
      expect(builtEnv.XDG_RUNTIME_DIR).toBe('/run/user/1000');
      expect(builtEnv.CUSTOM_VAR).toBe('val');
    });
  });
});
