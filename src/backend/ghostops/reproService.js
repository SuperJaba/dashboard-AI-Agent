import { execSync, spawn } from 'child_process';
import path from 'path';
import os from 'os';
import fs from 'fs';

/**
 * Creates an isolated git worktree for reproducing CI failures and testing fixes.
 *
 * @param {string} repoPath Path to the repository root.
 * @param {string} headSha Git commit SHA to checkout.
 * @param {string} branchName New branch name for the fix attempt.
 * @returns {Promise<string>} Created worktree directory path.
 */
export async function createWorktree(repoPath, headSha, branchName) {
  const worktreePath = path.join(os.tmpdir(), `ghostops-${branchName}-${Date.now()}`);
  execSync(`git worktree add -b ${branchName} ${worktreePath} ${headSha}`, { cwd: repoPath });
  return worktreePath;
}

/**
 * Runs an AI agent fix command inside the isolated worktree directory.
 *
 * @param {string} worktreePath Path to the worktree.
 * @param {string} errorContext CI failure or test error logs excerpt.
 * @param {string} agentCmd Command to execute (defaults to 'claude').
 * @returns {Promise<string>} Standard output from the agent command.
 */
export async function runAgentFix(worktreePath, errorContext, agentCmd = 'claude') {
  const prompt = `Fixing CI failure. Error context:\n${errorContext}\n\nAnalyze the error, write a failing regression test, then fix the code to make it pass.`;

  return new Promise((resolve, reject) => {
    const proc = spawn(agentCmd, ['--print', prompt], {
      cwd: worktreePath,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let output = '';
    let errorOutput = '';

    proc.stdout?.on('data', (chunk) => {
      output += chunk.toString();
    });

    proc.stderr?.on('data', (chunk) => {
      errorOutput += chunk.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(output);
      } else {
        reject(new Error(`Agent exited with code ${code}${errorOutput ? `: ${errorOutput}` : ''}`));
      }
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Cleans up and removes the temporary worktree and any remaining directory artifacts.
 *
 * @param {string} repoPath Path to the repository root.
 * @param {string} worktreePath Path to the worktree to remove.
 */
export function cleanupWorktree(repoPath, worktreePath) {
  try {
    execSync(`git worktree remove --force ${worktreePath}`, { cwd: repoPath });
  } catch {
    // Ignore git worktree remove failure and proceed to fs cleanup
  }

  try {
    if (fs.existsSync(worktreePath)) {
      fs.rmSync(worktreePath, { recursive: true, force: true });
    }
  } catch {
    // Ignore fs cleanup failure
  }
}
