import fs from 'fs';
import path from 'path';
import { execSync, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = typeof exec === 'function' ? promisify(exec) : async () => ({ stdout: '' });

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
    branch = execSync('git branch --show-current', execOpts).toString().trim();
  } catch  {}

  try {
    const statusOut = execSync('git status -s', execOpts).toString().trim();
    changes = statusOut ? statusOut.split(/\r?\n/) : [];
  } catch  {}

  try {
    const logOut = execSync('git log -n 10 --pretty=format:"%h|%s|%ar|%an"', execOpts).toString().trim();
    commits = logOut ? logOut.split(/\r?\n/).map(line => {
      const parts = line.split('|');
      return { hash: parts[0], msg: parts[1], time: parts[2], author: parts[3] };
    }) : [];
  } catch  {}

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
    current = execSync('git branch --show-current', execOpts).toString().trim();
  } catch  {}

  try {
    const branchOut = execSync('git branch -a --format="%(refname:short)|%(HEAD)"', execOpts).toString().trim();
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
  } catch  {
    // Fallback simple list
    try {
      const simpleOut = execSync('git branch', execOpts).toString().trim();
      simpleOut.split(/\r?\n/).forEach(b => {
        const clean = b.replace('*', '').trim();
        if (clean) local.push(clean);
      });
    } catch  {}
  }

  return { current, local, remote };
}

export function checkoutBranch(directory, branch, createNew = false) {
  const resolved = resolveDirectory(directory);
  if (!isGitRepo(resolved)) {
    throw new Error('Not a git repository');
  }

  const execOpts = { cwd: resolved, stdio: ['pipe', 'pipe', 'pipe'] };
  if (createNew) {
    execSync(`git checkout -b "${branch}"`, execOpts);
  } else {
    execSync(`git checkout "${branch}"`, execOpts);
  }

  const current = execSync('git branch --show-current', execOpts).toString().trim();
  return { success: true, current };
}

export function createBranch(directory, branch) {
  const resolved = resolveDirectory(directory);
  if (!isGitRepo(resolved)) {
    throw new Error('Not a git repository');
  }

  const execOpts = { cwd: resolved, stdio: ['pipe', 'pipe', 'pipe'] };
  execSync(`git branch "${branch}"`, execOpts);
  return { success: true, branch };
}

export function deleteBranch(directory, branch, force = false) {
  const resolved = resolveDirectory(directory);
  if (!isGitRepo(resolved)) {
    throw new Error('Not a git repository');
  }

  const execOpts = { cwd: resolved, stdio: ['pipe', 'pipe', 'pipe'] };
  execSync(`git branch ${force ? '-D' : '-d'} "${branch}"`, execOpts);
  return { success: true, branch };
}

export function getDiff(directory, staged = false, file = null) {
  const resolved = resolveDirectory(directory);
  if (!isGitRepo(resolved)) {
    throw new Error('Not a git repository');
  }

  const execOpts = { cwd: resolved, stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 10 * 1024 * 1024 };
  const fileArg = file ? ` -- "${file}"` : '';
  const stagedFlag = staged ? ' --staged' : '';
  
  let diff = '';
  let stat = '';

  try {
    diff = execSync(`git diff${stagedFlag}${fileArg}`, execOpts).toString();
  } catch (e) {
    diff = e.stdout ? e.stdout.toString() : '';
  }

  try {
    stat = execSync(`git diff --stat${stagedFlag}${fileArg}`, execOpts).toString();
  } catch  {
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
  const fileArgs = fileList.map(f => `"${f}"`).join(' ');
  execSync(`git add ${fileArgs}`, execOpts);

  return { success: true, staged: fileList };
}

export function unstageFiles(directory, files = ['.']) {
  const resolved = resolveDirectory(directory);
  if (!isGitRepo(resolved)) {
    throw new Error('Not a git repository');
  }

  const execOpts = { cwd: resolved, stdio: ['pipe', 'pipe', 'pipe'] };
  const fileList = Array.isArray(files) ? files : [files];
  const fileArgs = fileList.map(f => `"${f}"`).join(' ');
  try {
    execSync(`git restore --staged ${fileArgs}`, execOpts);
  } catch  {
    execSync(`git reset HEAD -- ${fileArgs}`, execOpts);
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
  const cleanMsg = message.replace(/"/g, '\\"');
  const output = execSync(`git commit -m "${cleanMsg}"`, execOpts).toString();

  return { success: true, output };
}

export function pullChanges(directory, remote = 'origin', branch = '') {
  const resolved = resolveDirectory(directory);
  if (!isGitRepo(resolved)) {
    throw new Error('Not a git repository');
  }

  const execOpts = { cwd: resolved, stdio: ['pipe', 'pipe', 'pipe'] };
  const branchArg = branch ? ` "${branch}"` : '';
  const output = execSync(`git pull --rebase "${remote}"${branchArg}`, execOpts).toString();

  return { success: true, log: output };
}

export function pushChanges(directory, remote = 'origin', branch = '', force = false) {
  const resolved = resolveDirectory(directory);
  if (!isGitRepo(resolved)) {
    throw new Error('Not a git repository');
  }

  const execOpts = { cwd: resolved, stdio: ['pipe', 'pipe', 'pipe'] };
  let currentBranch = branch;
  if (!currentBranch) {
    try {
      currentBranch = execSync('git branch --show-current', execOpts).toString().trim();
    } catch  {}
  }

  const forceFlag = force ? ' --force-with-lease' : '';
  const branchArg = currentBranch ? ` "${currentBranch}"` : '';
  const output = execSync(`git push -u "${remote}"${branchArg}${forceFlag}`, execOpts).toString();

  return { success: true, log: output };
}

export function fetchChanges(directory, remote = 'origin') {
  const resolved = resolveDirectory(directory);
  if (!isGitRepo(resolved)) {
    throw new Error('Not a git repository');
  }

  const execOpts = { cwd: resolved, stdio: ['pipe', 'pipe', 'pipe'] };
  const output = execSync(`git fetch "${remote}" --prune`, execOpts).toString();

  return { success: true, log: output };
}

export function cloneRepo(repoUrl, targetDir) {
  if (!repoUrl || !repoUrl.trim()) {
    throw new Error('Repository URL is required');
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

  const output = execSync(`git clone "${repoUrl.trim()}" "${resolved}"`, { stdio: ['pipe', 'pipe', 'pipe'] }).toString();
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
  } catch  {
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
  } catch  {
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
    const runsOut = execSync('gh run list --status in_progress --json databaseId -q ".[].databaseId"', { cwd: resolved, stdio: ['pipe', 'pipe', 'pipe'] }).toString();
    runIds = runsOut.trim().split('\n').filter(Boolean);
  } catch  {
    // gh CLI might not be authenticated or fail
  }
  
  if (runIds.length === 0) {
    return { success: true, canceledCount: 0, message: 'No running CI jobs found' };
  }
  
  for (const id of runIds) {
    try {
      execSync(`gh run cancel ${id}`, { cwd: resolved });
    } catch  {
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
  const statusOut = execSync('git status -s', { cwd: resolved }).toString().trim();
  if (statusOut) {
    execSync('git add .', { cwd: resolved });
    execSync('git commit -m "Auto deploy from dashboard"', { cwd: resolved });
  }

  // 2. Pull and Push to remote
  try {
    execSync('git pull --rebase', { cwd: resolved });
  } catch (pullError) {
    console.warn('Git pull failed, pushing anyway (might be a new branch):', pullError.message);
  }
  execSync('git push', { cwd: resolved });

  let deployLog = 'Pushed successfully.\n';

  // 3. Execute deploy script if exists
  const deployScriptPath = path.join(resolved, 'scripts', 'deploy-ct8-optimized.sh');
  if (fs.existsSync(deployScriptPath)) {
    deployLog += 'Executing custom deploy script...\n';
    const scriptOutput = execSync(`bash "${deployScriptPath}"`, { cwd: resolved }).toString();
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
  
  execSync(`git -C "${targetDir}" init && git -C "${targetDir}" branch -m main`);
  return { success: true, branch: 'main' };
}
