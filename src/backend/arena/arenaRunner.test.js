import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createArenaRun,
  getArenaDiff,
  cleanupArena,
  getActiveArenas,
  clearActiveArenas
} from './arenaRunner.js';

describe('arenaRunner', () => {
  beforeEach(() => {
    clearActiveArenas?.();
  });

  it('creates an arena run with isolated worktree and spawns agent', async () => {
    const mockExec = vi.fn().mockReturnValue('');
    const mockSpawn = vi.fn().mockReturnValue({
      on: vi.fn((event, cb) => {
        if (event === 'close') cb(0);
      }),
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      kill: vi.fn(),
    });

    const run = await createArenaRun({
      originalTaskId: 'task-100',
      agentCmd: 'claude',
      prompt: 'Refactor auth controller',
      repoPath: '/workspace/project',
      execFn: mockExec,
      spawnFn: mockSpawn
    });

    expect(run).toBeDefined();
    expect(run.runId).toBeDefined();
    expect(run.arenaPath).toContain('arena-');
    expect(mockExec).toHaveBeenCalledWith(
      expect.stringContaining('git worktree add -b arena-'),
      expect.objectContaining({ cwd: '/workspace/project' })
    );

    const active = getActiveArenas();
    expect(active).toHaveLength(1);
    expect(active[0].agent).toBe('claude');
    expect(active[0].status).toBe('done');
  });

  it('retrieves unified git diff between HEAD and arena branch', () => {
    const mockExec = vi.fn((cmd) => {
      if (cmd.startsWith('git diff')) {
        return '--- a/auth.js\n+++ b/auth.js\n@@ -1 +1 @@\n-old\n+new';
      }
      return '';
    });

    const run = {
      runId: 'test-arena-1',
      branchName: 'arena-branch-1',
      arenaPath: '/tmp/arena-1',
      repoPath: '/workspace/project',
      status: 'done',
      agent: 'claude',
      execFn: mockExec
    };

    // Prepopulate active arenas
    createArenaRun({
      originalTaskId: 'task-1',
      agentCmd: 'claude',
      prompt: 'fix',
      repoPath: '/workspace/project',
      execFn: mockExec,
      spawnFn: vi.fn().mockReturnValue({ on: vi.fn((ev, cb) => ev === 'close' && cb(0)), kill: vi.fn() })
    }).then((created) => {
      const diff = getArenaDiff(created.runId, { execFn: mockExec });
      expect(diff).toContain('--- a/auth.js');
      expect(diff).toContain('+new');
    });
  });

  it('cleans up arena worktree, branch, and active arena state', async () => {
    const mockKill = vi.fn();
    const mockExec = vi.fn().mockReturnValue('');
    const mockSpawn = vi.fn().mockReturnValue({
      on: vi.fn(),
      kill: mockKill
    });

    const run = await createArenaRun({
      originalTaskId: 'task-2',
      agentCmd: 'gemini',
      prompt: 'optimize queries',
      repoPath: '/workspace/project',
      execFn: mockExec,
      spawnFn: mockSpawn
    });

    expect(getActiveArenas()).toHaveLength(1);

    cleanupArena(run.runId, { execFn: mockExec });

    expect(mockKill).toHaveBeenCalledWith('SIGTERM');
    expect(mockExec).toHaveBeenCalledWith(
      expect.stringContaining('git worktree remove --force'),
      expect.objectContaining({ cwd: '/workspace/project' })
    );
    expect(getActiveArenas()).toHaveLength(0);
  });
});
