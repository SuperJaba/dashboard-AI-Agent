import { execSync, spawn } from 'child_process';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

const activeArenas = new Map(); // runId -> { arenaPath, repoPath, proc, status, branchName, agent }

export async function createArenaRun({
  originalTaskId,
  agentCmd = 'claude',
  prompt = '',
  repoPath = process.cwd(),
  execFn = execSync,
  spawnFn = spawn
}) {
  const runId = crypto.randomUUID();
  const branchName = `arena-${runId.slice(0, 8)}`;
  const arenaPath = path.join(os.tmpdir(), `arena-${branchName}`);

  // Tworzenie git worktree z bieżącym HEAD
  execFn(`git worktree add -b ${branchName} ${arenaPath} HEAD`, { cwd: repoPath });

  const record = {
    originalTaskId,
    arenaPath,
    repoPath,
    branchName,
    agent: agentCmd,
    status: 'running',
    createdAt: new Date().toISOString(),
    proc: null
  };

  activeArenas.set(runId, record);

  const proc = spawnFn(agentCmd, ['--print', prompt], {
    cwd: arenaPath,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  proc.on?.('close', (code) => {
    const arena = activeArenas.get(runId);
    if (arena) {
      arena.status = code === 0 ? 'done' : 'failed';
    }
  });

  record.proc = proc;
  return { runId, arenaPath };
}

export function getArenaDiff(runId, { execFn = execSync } = {}) {
  const arena = activeArenas.get(runId);
  if (!arena) throw new Error(`Arena ${runId} not found`);

  try {
    const diff = execFn(`git diff HEAD..${arena.branchName}`, {
      cwd: arena.repoPath,
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024
    });
    return typeof diff === 'string' ? diff : '';
  } catch {
    return '';
  }
}

export function cleanupArena(runId, { execFn = execSync } = {}) {
  const arena = activeArenas.get(runId);
  if (!arena) return;

  try {
    arena.proc?.kill?.('SIGTERM');
  } catch { /* ignore */ }

  try {
    execFn(`git worktree remove --force ${arena.arenaPath}`, { cwd: arena.repoPath });
  } catch { /* ignore */ }

  try {
    execFn(`git branch -D ${arena.branchName}`, { cwd: arena.repoPath });
  } catch { /* ignore */ }

  activeArenas.delete(runId);
}

export function getActiveArenas() {
  return Array.from(activeArenas.entries()).map(([id, a]) => ({
    runId: id,
    originalTaskId: a.originalTaskId,
    agent: a.agent,
    status: a.status,
    arenaPath: a.arenaPath,
    createdAt: a.createdAt
  }));
}

export function clearActiveArenas() {
  activeArenas.clear();
}
