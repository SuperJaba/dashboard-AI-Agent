import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Detects the best command to run an application based on its directory structure and files.
 * @param {string} projectPath
 * @returns {{ command: string, args: string[], type: string }}
 */
export function detectRunCommand(projectPath) {
  if (!projectPath || typeof projectPath !== 'string') {
    return { command: 'echo "No project path"', args: [], type: 'unknown' };
  }

  let target = projectPath.trim().replace(/^["']|["']$/g, '');
  if (target.startsWith('~/')) {
    const home = process.env.HOME || process.env.USERPROFILE || '';
    target = path.join(home, target.slice(2));
  }
  target = path.resolve(target);

  if (!fs.existsSync(target)) {
    return { command: 'echo "Path not found"', args: [], type: 'unknown' };
  }

  try {
    const files = fs.readdirSync(target);

    // 1. Node.js (package.json)
    if (files.includes('package.json')) {
      try {
        const pkg = JSON.parse(fs.readFileSync(path.join(target, 'package.json'), 'utf8'));
        const scripts = pkg.scripts || {};

        if (scripts.dev) {
          return { command: 'npm', args: ['run', 'dev'], type: 'npm-dev' };
        }
        if (scripts.start) {
          return { command: 'npm', args: ['start'], type: 'npm-start' };
        }
        if (scripts['dev:frontend']) {
          return { command: 'npm', args: ['run', 'dev:frontend'], type: 'npm-dev' };
        }
        if (files.includes('server.js')) {
          return { command: 'node', args: ['server.js'], type: 'node' };
        }
        if (files.includes('index.js')) {
          return { command: 'node', args: ['index.js'], type: 'node' };
        }
        if (files.includes('app.js')) {
          return { command: 'node', args: ['app.js'], type: 'node' };
        }
        return { command: 'npm', args: ['start'], type: 'npm-start' };
      } catch {
        return { command: 'npm', args: ['start'], type: 'npm-fallback' };
      }
    }

    // 2. Python
    if (files.includes('main.py')) {
      return { command: 'python3', args: ['main.py'], type: 'python' };
    }
    if (files.includes('app.py')) {
      return { command: 'python3', args: ['app.py'], type: 'python' };
    }
    if (files.includes('manage.py')) {
      return { command: 'python3', args: ['manage.py', 'runserver'], type: 'django' };
    }
    if (files.includes('pyproject.toml') || files.includes('requirements.txt')) {
      return { command: 'python3', args: ['-m', 'http.server', '8000'], type: 'python' };
    }

    // 3. Rust
    if (files.includes('Cargo.toml')) {
      return { command: 'cargo', args: ['run'], type: 'cargo' };
    }

    // 4. Go
    if (files.includes('go.mod') || files.includes('main.go')) {
      return { command: 'go', args: ['run', '.'], type: 'go' };
    }

    // 5. HTML / static
    if (files.includes('index.html')) {
      return { command: 'npx', args: ['serve', '.'], type: 'static' };
    }

    // Default fallback
    return { command: 'bash', args: [], type: 'shell' };
  } catch {
    return { command: 'bash', args: [], type: 'error' };
  }
}

/**
 * Creates a runner script in temporary directory to execute the app command.
 * @param {string} projectPath 
 * @param {string} runCommand 
 * @returns {string} Path to created script file
 */
export function prepareAppRunScript(projectPath, runCommand) {
  const tmpDir = os.tmpdir ? os.tmpdir() : '/tmp';
  const timestamp = Date.now();
  const scriptPath = path.join(tmpDir, `run-app-${timestamp}.sh`);

  const fullCmd = runCommand || 'npm run dev';
  const scriptContent = `#!/usr/bin/env bash
cd "${projectPath}" || exit 1
echo -e "\\033[1;34m[Workspace Runner]\\033[0m Starting application in ${projectPath}..."
echo -e "\\033[1;32m[Command]\\033[0m ${fullCmd}"
echo ""
exec ${fullCmd}
`;

  fs.writeFileSync(scriptPath, scriptContent, { mode: 0o755 });
  return scriptPath;
}
