import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

function isGitRepo(directory) {
  return fs.existsSync(path.join(directory, '.git'));
}

export function getStatus(directory) {
  if (!isGitRepo(directory)) {
    throw new Error('Not a git repository');
  }
  
  const execOpts = { stdio: ['pipe', 'pipe', 'pipe'] };
  let branch = '';
  let changes = [];
  let commits = [];

  try {
    branch = execSync(`git -C "${directory}" branch --show-current`, execOpts).toString().trim();
  } catch (e) {}

  try {
    const statusOut = execSync(`git -C "${directory}" status -s`, execOpts).toString().trim();
    changes = statusOut ? statusOut.split('\n') : [];
  } catch (e) {}

  try {
    const logOut = execSync(`git -C "${directory}" log -n 5 --pretty=format:"%h|%s|%ar|%an"`, execOpts).toString().trim();
    commits = logOut ? logOut.split('\n').map(line => {
      const parts = line.split('|');
      return { hash: parts[0], msg: parts[1], time: parts[2], author: parts[3] };
    }) : [];
  } catch (e) {}

  return { branch, changes, commits };
}

export function getGithubPRsAndRuns(directory) {
  if (!isGitRepo(directory)) {
    throw new Error('Not a git repository');
  }
  
  let prs = [];
  try {
    const prsOut = execSync(`gh pr list --json title,number,url,state --limit 5`, { cwd: directory, stdio: ['pipe', 'pipe', 'pipe'] }).toString();
    prs = JSON.parse(prsOut || '[]');
  } catch (e) {
    // gh CLI might not be authenticated
  }
  
  let latestRun = null;
  try {
    const runsOut = execSync(`gh run list --limit 1 --json status,conclusion`, { cwd: directory, stdio: ['pipe', 'pipe', 'pipe'] }).toString();
    const runs = JSON.parse(runsOut || '[]');
    latestRun = runs.length > 0 ? runs[0] : null;
  } catch (e) {
    // gh CLI might not be authenticated
  }
  
  return { prs, latestRun };
}

export function cancelCIJobs(directory) {
  if (!isGitRepo(directory)) {
    throw new Error('Not a git repository');
  }
  
  let runIds = [];
  try {
    const runsOut = execSync(`gh run list --status in_progress --json databaseId -q ".[].databaseId"`, { cwd: directory, stdio: ['pipe', 'pipe', 'pipe'] }).toString();
    runIds = runsOut.trim().split('\n').filter(Boolean);
  } catch (e) {
    // gh CLI might not be authenticated or fail
  }
  
  if (runIds.length === 0) {
    return { success: true, canceledCount: 0, message: 'No running CI jobs found' };
  }
  
  for (const id of runIds) {
    try {
      execSync(`gh run cancel ${id}`, { cwd: directory });
    } catch (e) {
      // Ignore single cancellation error
    }
  }
  
  return { success: true, canceledCount: runIds.length };
}

export function autoDeploy(directory) {
  if (!isGitRepo(directory)) {
    throw new Error('Not a git repository');
  }

  // 1. Commit any uncommitted changes
  const statusOut = execSync(`git -C "${directory}" status -s`).toString().trim();
  if (statusOut) {
    execSync(`git -C "${directory}" add .`);
    execSync(`git -C "${directory}" commit -m "Auto deploy from dashboard"`);
  }

  // 2. Pull and Push to remote
  try {
    execSync(`git -C "${directory}" pull --rebase`);
  } catch (pullError) {
    console.warn('Git pull failed, pushing anyway (might be a new branch):', pullError.message);
  }
  execSync(`git -C "${directory}" push`);

  let deployLog = "Pushed successfully.\n";

  // 3. Execute deploy script if exists
  const deployScriptPath = path.join(directory, 'scripts', 'deploy-ct8-optimized.sh');
  if (fs.existsSync(deployScriptPath)) {
    deployLog += "Executing custom deploy script...\n";
    const scriptOutput = execSync(`bash "${deployScriptPath}"`, { cwd: directory }).toString();
    deployLog += scriptOutput;
  } else {
    deployLog += "No custom deploy script found. Skipped remote execution.\n";
  }

  return { success: true, deployLog };
}

export function initGit(directory) {
  let targetDir = directory;
  if (targetDir.startsWith('~/')) {
    const home = process.env.HOME || process.env.USERPROFILE;
    targetDir = path.join(home, targetDir.slice(2));
  }
  
  execSync(`git -C "${targetDir}" init && git -C "${targetDir}" branch -m main`);
  return { success: true, branch: 'main' };
}
