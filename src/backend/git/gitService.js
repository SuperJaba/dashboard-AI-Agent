import fs from 'fs';
import path from 'path';
import { execFileSync, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = typeof exec === 'function' ? promisify(exec) : async () => ({ stdout: '' });

/**
 * Validates branch names against unsafe characters and path traversal.
 */
export function validateBranchName(branch) {
  if (!branch || typeof branch !== 'string') {
    throw new Error('Branch name is required');
  }
  const trimmed = branch.trim();
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._\-/]*$/.test(trimmed) || trimmed.includes('..') || trimmed.endsWith('.lock')) {
    throw new Error(`Invalid branch name: ${branch}`);
  }
  return trimmed;
}

export function resolveDirectory(dir) {
  if (!dir || typeof dir !== 'string') return '';
  if (dir.startsWith('~/')) {
    const home = process.env.HOME || process.env.USERPROFILE || '';
    return path.join(home, dir.slice(2));
  }
  return path.resolve(dir);
}

export function isGitRepo(directory) {
  if (!directory || typeof directory !== 'string') return false;
  try {
    const resolved = resolveDirectory(directory);
    if (!resolved) return false;
    return fs.existsSync(path.join(resolved, '.git'));
  } catch {
    return false;
  }
}

export function getStatus(directory) {
  const resolved = resolveDirectory(directory);
  if (!isGitRepo(resolved)) {
    throw new Error('Not a git repository');
  }
  
  const execOpts = { cwd: resolved, stdio: ['pipe', 'pipe', 'pipe'], timeout: 5000 };
  let branch = '';
  let changes = [];
  let commits = [];

  try {
    branch = execFileSync('git', ['branch', '--show-current'], execOpts).toString().trim();
  } catch {}

  try {
    const statusOut = execFileSync('git', ['status', '-s'], execOpts).toString().trim();
    changes = statusOut ? statusOut.split(/\r?\n/) : [];
  } catch {}

  try {
    const logOut = execFileSync('git', ['log', '-n', '10', '--pretty=format:%h|%s|%ar|%an'], execOpts).toString().trim();
    commits = logOut ? logOut.split(/\r?\n/).map(line => {
      const parts = line.split('|');
      return { hash: parts[0], msg: parts[1], time: parts[2], author: parts[3] };
    }) : [];
  } catch {}

  return { branch, changes, commits };
}

export function getBranches(directory) {
  const resolved = resolveDirectory(directory);
  if (!isGitRepo(resolved)) {
    throw new Error('Not a git repository');
  }

  const execOpts = { cwd: resolved, stdio: ['pipe', 'pipe', 'pipe'] };
  let current = '';
  const local = [];
  const remote = [];

  try {
    current = execFileSync('git', ['branch', '--show-current'], execOpts).toString().trim();
  } catch {}

  try {
    const branchOut = execFileSync('git', ['branch', '-a', '--format=%(refname:short)|%(HEAD)'], execOpts).toString().trim();
    const lines = branchOut ? branchOut.split(/\r?\n/) : [];
    
    for (const line of lines) {
      if (!line.trim()) continue;
      const [ref, headMark] = line.split('|');
      const isHead = headMark === '*';
      if (isHead && !current) {
        current = ref;
      }
      if (ref.startsWith('origin/')) {
        if (!ref.endsWith('/HEAD')) {
          remote.push(ref);
        }
      } else {
        local.push(ref);
      }
    }
  } catch {
    // Fallback simple list
    try {
      const simpleOut = execFileSync('git', ['branch'], execOpts).toString().trim();
      simpleOut.split(/\r?\n/).forEach(b => {
        const clean = b.replace('*', '').trim();
        if (clean) local.push(clean);
      });
    } catch {}
  }

  return { current, local, remote };
}

export function checkoutBranch(directory, branch, createNew = false) {
  const resolved = resolveDirectory(directory);
  if (!isGitRepo(resolved)) {
    throw new Error('Not a git repository');
  }
  const validBranch = validateBranchName(branch);

  const execOpts = { cwd: resolved, stdio: ['pipe', 'pipe', 'pipe'] };
  if (createNew) {
    execFileSync('git', ['checkout', '-b', validBranch], execOpts);
  } else {
    execFileSync('git', ['checkout', validBranch], execOpts);
  }

  const current = execFileSync('git', ['branch', '--show-current'], execOpts).toString().trim();
  return { success: true, current };
}

export function createBranch(directory, branch) {
  const resolved = resolveDirectory(directory);
  if (!isGitRepo(resolved)) {
    throw new Error('Not a git repository');
  }
  const validBranch = validateBranchName(branch);

  const execOpts = { cwd: resolved, stdio: ['pipe', 'pipe', 'pipe'] };
  execFileSync('git', ['branch', validBranch], execOpts);
  return { success: true, branch: validBranch };
}

export function deleteBranch(directory, branch, force = false) {
  const resolved = resolveDirectory(directory);
  if (!isGitRepo(resolved)) {
    throw new Error('Not a git repository');
  }
  const validBranch = validateBranchName(branch);

  const execOpts = { cwd: resolved, stdio: ['pipe', 'pipe', 'pipe'] };
  execFileSync('git', ['branch', force ? '-D' : '-d', validBranch], execOpts);
  return { success: true, branch: validBranch };
}

export function getDiff(directory, staged = false, file = null) {
  const resolved = resolveDirectory(directory);
  if (!isGitRepo(resolved)) {
    throw new Error('Not a git repository');
  }

  const execOpts = { cwd: resolved, stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 10 * 1024 * 1024 };
  const diffArgs = ['diff'];
  if (staged) diffArgs.push('--staged');
  if (file) diffArgs.push('--', file);

  const statArgs = ['diff', '--stat'];
  if (staged) statArgs.push('--staged');
  if (file) statArgs.push('--', file);

  let diff = '';
  let stat = '';

  try {
    diff = execFileSync('git', diffArgs, execOpts).toString();
  } catch (e) {
    diff = e.stdout ? e.stdout.toString() : '';
  }

  try {
    stat = execFileSync('git', statArgs, execOpts).toString();
  } catch {
    stat = '';
  }

  return { diff, stat, staged: Boolean(staged) };
}

export function stageFiles(directory, files = ['.']) {
  const resolved = resolveDirectory(directory);
  if (!isGitRepo(resolved)) {
    throw new Error('Not a git repository');
  }

  const execOpts = { cwd: resolved, stdio: ['pipe', 'pipe', 'pipe'] };
  const fileList = Array.isArray(files) ? files : [files];
  execFileSync('git', ['add', '--', ...fileList], execOpts);

  return { success: true, staged: fileList };
}

export function unstageFiles(directory, files = ['.']) {
  const resolved = resolveDirectory(directory);
  if (!isGitRepo(resolved)) {
    throw new Error('Not a git repository');
  }

  const execOpts = { cwd: resolved, stdio: ['pipe', 'pipe', 'pipe'] };
  const fileList = Array.isArray(files) ? files : [files];
  try {
    execFileSync('git', ['restore', '--staged', '--', ...fileList], execOpts);
  } catch {
    execFileSync('git', ['reset', 'HEAD', '--', ...fileList], execOpts);
  }

  return { success: true, unstaged: fileList };
}

export function commitChanges(directory, message) {
  const resolved = resolveDirectory(directory);
  if (!isGitRepo(resolved)) {
    throw new Error('Not a git repository');
  }
  if (!message || !message.trim()) {
    throw new Error('Commit message is required');
  }

  const execOpts = { cwd: resolved, stdio: ['pipe', 'pipe', 'pipe'] };
  const output = execFileSync('git', ['commit', '-m', message], execOpts).toString();

  return { success: true, output };
}

export function pullChanges(directory, remote = 'origin', branch = '') {
  const resolved = resolveDirectory(directory);
  if (!isGitRepo(resolved)) {
    throw new Error('Not a git repository');
  }

  const execOpts = { cwd: resolved, stdio: ['pipe', 'pipe', 'pipe'] };
  const args = ['pull', '--rebase', remote];
  if (branch) {
    args.push(validateBranchName(branch));
  }
  const output = execFileSync('git', args, execOpts).toString();

  return { success: true, log: output };
}

export function pushChanges(directory, remote = 'origin', branch = '', force = false) {
  const resolved = resolveDirectory(directory);
  if (!isGitRepo(resolved)) {
    throw new Error('Not a git repository');
  }

  const execOpts = { cwd: resolved, stdio: ['pipe', 'pipe', 'pipe'] };
  let currentBranch = branch ? validateBranchName(branch) : '';
  if (!currentBranch) {
    try {
      const detected = execFileSync('git', ['branch', '--show-current'], execOpts).toString().trim();
      if (detected && /^[a-zA-Z0-9][a-zA-Z0-9._\-/]*$/.test(detected)) {
        currentBranch = detected;
      }
    } catch {}
  }

  const args = ['push', '-u', remote];
  if (currentBranch) {
    args.push(currentBranch);
  }
  if (force) {
    args.push('--force-with-lease');
  }

  const output = execFileSync('git', args, execOpts).toString();
  return { success: true, log: output };
}

export function fetchChanges(directory, remote = 'origin') {
  const resolved = resolveDirectory(directory);
  if (!isGitRepo(resolved)) {
    throw new Error('Not a git repository');
  }

  const execOpts = { cwd: resolved, stdio: ['pipe', 'pipe', 'pipe'] };
  const output = execFileSync('git', ['fetch', remote, '--prune'], execOpts).toString();

  return { success: true, log: output };
}

export function cloneRepo(repoUrl, targetDir) {
  if (!repoUrl || !repoUrl.trim()) {
    throw new Error('Repository URL is required');
  }
  const trimmedUrl = repoUrl.trim();
  if (trimmedUrl.startsWith('-')) {
    throw new Error('Invalid repository URL');
  }

  if (!targetDir || !targetDir.trim()) {
    throw new Error('Target directory is required');
  }

  const resolved = resolveDirectory(targetDir);
  if (fs.existsSync(resolved) && fs.readdirSync(resolved).length > 0) {
    throw new Error(`Target directory is not empty: ${resolved}`);
  }

  const parentDir = path.dirname(resolved);
  if (!fs.existsSync(parentDir)) {
    fs.mkdirSync(parentDir, { recursive: true });
  }

  const output = execFileSync('git', ['clone', trimmedUrl, resolved], { stdio: ['pipe', 'pipe', 'pipe'] }).toString();
  return { success: true, directory: resolved, log: output };
}

export async function getGithubPRsAndRuns(directory) {
  const resolved = resolveDirectory(directory);
  if (!isGitRepo(resolved)) {
    throw new Error('Not a git repository');
  }

  const GH_TIMEOUT_MS = 8000;
  
  let prs = [];
  try {
    const { stdout: prsOut } = await execAsync(
      'gh pr list --json title,number,url,state --limit 5',
      { cwd: resolved, timeout: GH_TIMEOUT_MS }
    );
    prs = JSON.parse(prsOut || '[]');
  } catch {
    // gh CLI might not be authenticated or timed out
  }
  
  let latestRun = null;
  try {
    const { stdout: runsOut } = await execAsync(
      'gh run list --limit 1 --json status,conclusion',
      { cwd: resolved, timeout: GH_TIMEOUT_MS }
    );
    const runs = JSON.parse(runsOut || '[]');
    latestRun = runs.length > 0 ? runs[0] : null;
  } catch {
    // gh CLI might not be authenticated or timed out
  }
  
  return { prs, latestRun };
}

export function cancelCIJobs(directory) {
  const resolved = resolveDirectory(directory);
  if (!isGitRepo(resolved)) {
    throw new Error('Not a git repository');
  }
  
  let runIds = [];
  try {
    const runsOut = execFileSync(
      'gh',
      ['run', 'list', '--status', 'in_progress', '--json', 'databaseId', '-q', '.[].databaseId'],
      { cwd: resolved, stdio: ['pipe', 'pipe', 'pipe'] }
    ).toString();
    runIds = runsOut.trim().split('\n').filter(Boolean);
  } catch {
    // gh CLI might not be authenticated or fail
  }
  
  if (runIds.length === 0) {
    return { success: true, canceledCount: 0, message: 'No running CI jobs found' };
  }
  
  for (const id of runIds) {
    try {
      execFileSync('gh', ['run', 'cancel', id], { cwd: resolved });
    } catch {
      // Ignore single cancellation error
    }
  }
  
  return { success: true, canceledCount: runIds.length };
}

export function autoDeploy(directory) {
  const resolved = resolveDirectory(directory);
  if (!isGitRepo(resolved)) {
    throw new Error('Not a git repository');
  }

  // 1. Commit any uncommitted changes
  const statusOut = execFileSync('git', ['status', '-s'], { cwd: resolved }).toString().trim();
  if (statusOut) {
    execFileSync('git', ['add', '.'], { cwd: resolved });
    execFileSync('git', ['commit', '-m', 'Auto deploy from dashboard'], { cwd: resolved });
  }

  // 2. Pull and Push to remote
  try {
    execFileSync('git', ['pull', '--rebase'], { cwd: resolved });
  } catch (pullError) {
    console.warn('Git pull failed, pushing anyway (might be a new branch):', pullError.message);
  }
  execFileSync('git', ['push'], { cwd: resolved });

  let deployLog = 'Pushed successfully.\n';

  // 3. Execute deploy script if exists
  const deployScriptPath = path.join(resolved, 'scripts', 'deploy-ct8-optimized.sh');
  if (fs.existsSync(deployScriptPath)) {
    deployLog += 'Executing custom deploy script...\n';
    const scriptOutput = execFileSync('bash', [deployScriptPath], { cwd: resolved }).toString();
    deployLog += scriptOutput;
  } else {
    deployLog += 'No custom deploy script found. Skipped remote execution.\n';
  }

  return { success: true, deployLog };
}

export function initGit(directory) {
  const targetDir = resolveDirectory(directory);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  
  execFileSync('git', ['-C', targetDir, 'init']);
  execFileSync('git', ['-C', targetDir, 'branch', '-m', 'main']);
  return { success: true, branch: 'main' };
}
