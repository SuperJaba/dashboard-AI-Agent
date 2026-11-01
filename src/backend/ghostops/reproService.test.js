import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';

const mocks = vi.hoisted(() => {
  return {
    execSync: vi.fn(),
    spawn: vi.fn(),
    existsSync: vi.fn(),
    rmSync: vi.fn(),
  };
});

vi.mock('child_process', () => {
  return {
    default: {
      execSync: mocks.execSync,
      spawn: mocks.spawn,
    },
    execSync: mocks.execSync,
    spawn: mocks.spawn,
  };
});

vi.mock('fs', () => {
  return {
    default: {
      existsSync: mocks.existsSync,
      rmSync: mocks.rmSync,
    },
    existsSync: mocks.existsSync,
    rmSync: mocks.rmSync,
  };
});

import { createWorktree, runAgentFix, cleanupWorktree } from './reproService.js';

describe('Ghost Ops Repro Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createWorktree', () => {
    it('creates temporary worktree directory with git worktree add', async () => {
      mocks.execSync.mockReturnValue(Buffer.from(''));

      const repoPath = '/media/seba/repo';
      const headSha = 'abc12345';
      const branchName = 'ghostops-fix-101';

      const worktreePath = await createWorktree(repoPath, headSha, branchName);

      expect(worktreePath).toContain('ghostops-fix-101');
      expect(mocks.execSync).toHaveBeenCalledTimes(1);
      const [cmd, options] = mocks.execSync.mock.calls[0];
      expect(cmd).toBe(`git worktree add -b ${branchName} ${worktreePath} ${headSha}`);
      expect(options).toEqual({ cwd: repoPath });
    });

    it('throws error if git worktree add fails', async () => {
      mocks.execSync.mockImplementation(() => {
        throw new Error('fatal: invalid reference');
      });

      await expect(createWorktree('/repo', 'invalid-sha', 'fix-branch'))
        .rejects.toThrow('fatal: invalid reference');
    });
  });

  describe('runAgentFix', () => {
    it('executes fix command with prompt and returns stdout on exit code 0', async () => {
      class MockProc extends EventEmitter {
        constructor() {
          super();
          this.stdout = new EventEmitter();
          this.stderr = new EventEmitter();
        }
      }

      const mockProc = new MockProc();
      mocks.spawn.mockImplementation(() => {
        process.nextTick(() => {
          mockProc.stdout.emit('data', Buffer.from('Fixing regression test...\n'));
          mockProc.stdout.emit('data', Buffer.from('Fix committed successfully.'));
          mockProc.emit('close', 0);
        });
        return mockProc;
      });

      const worktreePath = '/tmp/ghostops-test';
      const errorContext = 'FAIL: test_ci_pipeline failed on assert 1 == 2';
      const stdout = await runAgentFix(worktreePath, errorContext, 'claude');

      expect(mocks.spawn).toHaveBeenCalledTimes(1);
      const [cmd, args, opts] = mocks.spawn.mock.calls[0];
      expect(cmd).toBe('claude');
      expect(args[0]).toBe('--print');
      expect(args[1]).toContain(errorContext);
      expect(opts).toEqual({ cwd: worktreePath, stdio: ['ignore', 'pipe', 'pipe'] });
      expect(stdout).toBe('Fixing regression test...\nFix committed successfully.');
    });

    it('rejects if agent exits with non-zero exit code', async () => {
      class MockProc extends EventEmitter {
        constructor() {
          super();
          this.stdout = new EventEmitter();
          this.stderr = new EventEmitter();
        }
      }

      const mockProc = new MockProc();
      mocks.spawn.mockImplementation(() => {
        process.nextTick(() => {
          mockProc.stderr.emit('data', Buffer.from('Error: Out of quota'));
          mockProc.emit('close', 1);
        });
        return mockProc;
      });

      await expect(runAgentFix('/tmp/worktree', 'some error', 'claude'))
        .rejects.toThrow(/Agent exited with code 1/);
    });

    it('rejects if agent process encounters spawn error', async () => {
      class MockProc extends EventEmitter {
        constructor() {
          super();
          this.stdout = new EventEmitter();
          this.stderr = new EventEmitter();
        }
      }

      const mockProc = new MockProc();
      mocks.spawn.mockImplementation(() => {
        process.nextTick(() => {
          mockProc.emit('error', new Error('spawn claude ENOENT'));
        });
        return mockProc;
      });

      await expect(runAgentFix('/tmp/worktree', 'some error', 'nonexistent-cmd'))
        .rejects.toThrow('spawn claude ENOENT');
    });
  });

  describe('cleanupWorktree', () => {
    it('removes temporary worktree cleanly via git worktree remove and fs.rmSync', async () => {
      mocks.existsSync.mockReturnValue(true);

      const repoPath = '/media/seba/repo';
      const worktreePath = '/tmp/ghostops-worktree-123';

      cleanupWorktree(repoPath, worktreePath);

      expect(mocks.execSync).toHaveBeenCalledWith(
        `git worktree remove --force ${worktreePath}`,
        { cwd: repoPath }
      );
      expect(mocks.existsSync).toHaveBeenCalledWith(worktreePath);
      expect(mocks.rmSync).toHaveBeenCalledWith(worktreePath, { recursive: true, force: true });
    });

    it('handles git worktree remove failure gracefully without throwing', () => {
      mocks.execSync.mockImplementation(() => {
        throw new Error('fatal: not a valid worktree');
      });
      mocks.existsSync.mockReturnValue(true);

      expect(() => {
        cleanupWorktree('/repo', '/tmp/ghostops-worktree-123');
      }).not.toThrow();

      expect(mocks.rmSync).toHaveBeenCalledWith('/tmp/ghostops-worktree-123', {
        recursive: true,
        force: true,
      });
    });
  });
});
