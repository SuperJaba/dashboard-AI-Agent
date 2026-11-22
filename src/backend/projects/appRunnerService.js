import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

/**
 * Detects the package manager used in a Node.js project directory.
 * @param {string} target
 * @returns {'pnpm' | 'bun' | 'yarn' | 'npm'}
 */
export function detectNodePackageManager(target) {
  try {
    const files = fs.readdirSync(target);
    if (files.includes('pnpm-lock.yaml')) return 'pnpm';
    if (files.includes('bun.lock') || files.includes('bun.lockb')) return 'bun';
    if (files.includes('yarn.lock')) return 'yarn';
  } catch {}
  return 'npm';
}

/**
 * Checks if a file exists and optionally if it matches a regex pattern.
 * @param {string} filePath
 * @param {RegExp} [pattern]
 * @returns {boolean}
 */
function fileMatches(filePath, pattern) {
  if (!fs.existsSync(filePath)) return false;
  if (!pattern) return true;
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return pattern.test(content);
  } catch {
    return false;
  }
}

/**
 * Detects Python run command for projects with Python backends or scripts.
 * @param {string} target
 * @param {string[]} files
 * @returns {{ command: string, args: string[], type: string } | null}
 */
export function detectPythonCommand(target, files) {
  const isFastApiPattern = /(from\s+fastapi|import\s+fastapi|FastAPI\(|uvicorn)/i;
  const isFlaskPattern = /(from\s+flask|import\s+flask|Flask\()/i;
  const isStreamlitPattern = /(from\s+streamlit|import\s+streamlit|st\.)/i;

  // 1. FastAPI / Uvicorn detection
  // Check backend/app/main.py (e.g. stock-dash backend structure)
  if (fileMatches(path.join(target, 'backend', 'app', 'main.py'), isFastApiPattern)) {
    return { command: 'uvicorn', args: ['app.main:app', '--reload', '--port', '8000'], type: 'python-fastapi' };
  }
  if (fileMatches(path.join(target, 'app', 'main.py'), isFastApiPattern)) {
    return { command: 'uvicorn', args: ['app.main:app', '--reload', '--port', '8000'], type: 'python-fastapi' };
  }
  if (files.includes('main.py') && fileMatches(path.join(target, 'main.py'), isFastApiPattern)) {
    return { command: 'uvicorn', args: ['main:app', '--reload', '--port', '8000'], type: 'python-fastapi' };
  }
  if (files.includes('app.py') && fileMatches(path.join(target, 'app.py'), isFastApiPattern)) {
    return { command: 'uvicorn', args: ['app:app', '--reload', '--port', '8000'], type: 'python-fastapi' };
  }
  if (files.includes('server.py') && fileMatches(path.join(target, 'server.py'), isFastApiPattern)) {
    return { command: 'uvicorn', args: ['server:app', '--reload', '--port', '8000'], type: 'python-fastapi' };
  }

  // 2. Streamlit apps
  if (files.includes('streamlit_app.py')) {
    return { command: 'streamlit', args: ['run', 'streamlit_app.py'], type: 'python-streamlit' };
  }
  if (files.includes('app.py') && fileMatches(path.join(target, 'app.py'), isStreamlitPattern)) {
    return { command: 'streamlit', args: ['run', 'app.py'], type: 'python-streamlit' };
  }

  // 3. Django
  if (files.includes('manage.py')) {
    return { command: 'python3', args: ['manage.py', 'runserver'], type: 'django' };
  }
  if (fs.existsSync(path.join(target, 'backend', 'manage.py'))) {
    return { command: 'python3', args: ['backend/manage.py', 'runserver'], type: 'django' };
  }

  // 4. Flask apps
  if (files.includes('app.py') && fileMatches(path.join(target, 'app.py'), isFlaskPattern)) {
    return { command: 'python3', args: ['app.py'], type: 'python-flask' };
  }

  // 5. Root entrypoint scripts
  if (files.includes('main.py')) {
    return { command: 'python3', args: ['main.py'], type: 'python' };
  }
  if (files.includes('app.py')) {
    return { command: 'python3', args: ['app.py'], type: 'python' };
  }
  if (files.includes('run.py')) {
    return { command: 'python3', args: ['run.py'], type: 'python' };
  }
  if (files.includes('server.py')) {
    return { command: 'python3', args: ['server.py'], type: 'python' };
  }

  // 6. Subdirectory entrypoints (e.g. OBD2-AI in ui/main.py, or backend/main.py)
  if (fs.existsSync(path.join(target, 'ui', 'main.py'))) {
    return { command: 'python3', args: ['ui/main.py'], type: 'python' };
  }
  if (fs.existsSync(path.join(target, 'backend', 'main.py'))) {
    return { command: 'python3', args: ['backend/main.py'], type: 'python' };
  }
  if (fs.existsSync(path.join(target, 'src', 'main.py'))) {
    return { command: 'python3', args: ['src/main.py'], type: 'python' };
  }
  if (fs.existsSync(path.join(target, 'src', 'app.py'))) {
    return { command: 'python3', args: ['src/app.py'], type: 'python' };
  }

  // 7. Dependency files (requirements.txt, pyproject.toml, Pipfile)
  const hasReqs = files.includes('requirements.txt') || fs.existsSync(path.join(target, 'backend', 'requirements.txt'));
  const hasPyproject = files.includes('pyproject.toml') || fs.existsSync(path.join(target, 'backend', 'pyproject.toml'));
  const hasPipfile = files.includes('Pipfile');
  const hasVenv = files.includes('.venv') || files.includes('venv') || fs.existsSync(path.join(target, 'backend', '.venv'));

  if (files.includes('poetry.lock')) {
    return { command: 'poetry', args: ['run', 'python', 'main.py'], type: 'poetry' };
  }
  if (hasPipfile) {
    return { command: 'pipenv', args: ['run', 'python', 'main.py'], type: 'pipenv' };
  }

  if (hasReqs || hasPyproject || hasVenv) {
    // Check if requirements explicitly reference fastapi or uvicorn
    const reqContent = hasReqs
      ? (fs.existsSync(path.join(target, 'requirements.txt'))
        ? fs.readFileSync(path.join(target, 'requirements.txt'), 'utf8')
        : fs.readFileSync(path.join(target, 'backend', 'requirements.txt'), 'utf8'))
      : '';
    if (/uvicorn|fastapi/i.test(reqContent)) {
      if (fs.existsSync(path.join(target, 'backend', 'app', 'main.py'))) {
        return { command: 'uvicorn', args: ['app.main:app', '--reload', '--port', '8000'], type: 'python-fastapi' };
      }
      return { command: 'uvicorn', args: ['main:app', '--reload', '--port', '8000'], type: 'python-fastapi' };
    }

    // Check if any root .py file exists
    const rootPy = files.find(f => f.endsWith('.py') && !f.startsWith('.'));
    if (rootPy) {
      return { command: 'python3', args: [rootPy], type: 'python' };
    }
    // Default sensible Python entrypoint
    return { command: 'python3', args: ['main.py'], type: 'python' };
  }

  return null;
}

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

    // 1. Explicit Shell start scripts (e.g. stock-dash start.sh multi-tier orchestrator)
    if (files.includes('start.sh')) {
      return { command: 'bash', args: ['start.sh'], type: 'shell-script' };
    }
    if (files.includes('run.sh')) {
      return { command: 'bash', args: ['run.sh'], type: 'shell-script' };
    }
    if (fs.existsSync(path.join(target, 'scripts', 'start.sh'))) {
      return { command: 'bash', args: ['scripts/start.sh'], type: 'shell-script' };
    }
    if (fs.existsSync(path.join(target, 'scripts', 'run.sh'))) {
      return { command: 'bash', args: ['scripts/run.sh'], type: 'shell-script' };
    }

    // 2. Makefile with explicit run/dev/start targets (e.g. Osintgram)
    if (files.includes('Makefile') || files.includes('makefile')) {
      try {
        const makefileContent = fs.readFileSync(path.join(target, files.includes('Makefile') ? 'Makefile' : 'makefile'), 'utf8');
        if (/^run:/m.test(makefileContent)) {
          return { command: 'make', args: ['run'], type: 'make' };
        }
        if (/^dev:/m.test(makefileContent)) {
          return { command: 'make', args: ['dev'], type: 'make' };
        }
        if (/^start:/m.test(makefileContent)) {
          return { command: 'make', args: ['start'], type: 'make' };
        }
      } catch {}
    }

    // 3. Node.js (package.json in root)
    if (files.includes('package.json')) {
      try {
        const pkg = JSON.parse(fs.readFileSync(path.join(target, 'package.json'), 'utf8'));
        const scripts = pkg.scripts || {};
        const pm = detectNodePackageManager(target);

        if (scripts.dev) {
          const runArgs = pm === 'npm' ? ['run', 'dev'] : (pm === 'bun' ? ['run', 'dev'] : ['dev']);
          return { command: pm, args: runArgs, type: `${pm}-dev` };
        }
        if (scripts.start) {
          const runArgs = pm === 'npm' ? ['start'] : (pm === 'bun' ? ['start'] : ['start']);
          return { command: pm, args: runArgs, type: `${pm}-start` };
        }
        if (scripts['dev:frontend']) {
          const runArgs = pm === 'npm' ? ['run', 'dev:frontend'] : (pm === 'bun' ? ['run', 'dev:frontend'] : ['dev:frontend']);
          return { command: pm, args: runArgs, type: `${pm}-dev` };
        }
        if (files.includes('server.js')) {
          return { command: 'node', args: ['server.js'], type: 'node' };
        }
        if (files.includes('index.js')) {
          return { command: 'node', args: ['index.js'], type: 'node' };
        }
        if (files.includes('app.js') && !files.includes('main.py') && !files.includes('requirements.txt')) {
          return { command: 'node', args: ['app.js'], type: 'node' };
        }

        // If package.json has NO dev/start scripts, check if Python exists before blind npm start fallback
        const pythonCmd = detectPythonCommand(target, files);
        if (pythonCmd) {
          return pythonCmd;
        }

        return { command: pm, args: ['start'], type: `${pm}-start` };
      } catch {
        // Continue to other runtimes if package.json fails to parse
      }
    }

    // 4. Python runtime
    const pythonResult = detectPythonCommand(target, files);
    if (pythonResult) {
      return pythonResult;
    }

    // 5. Rust
    if (files.includes('Cargo.toml')) {
      return { command: 'cargo', args: ['run'], type: 'cargo' };
    }

    // 6. Go
    if (files.includes('go.mod') || files.includes('main.go')) {
      return { command: 'go', args: ['run', '.'], type: 'go' };
    }

    // 7. Subdirectories with package.json (e.g. backend, frontend, server, client, app, ui)
    const subDirs = ['backend', 'frontend', 'server', 'client', 'app', 'ui', 'src'];
    for (const sub of subDirs) {
      if (files.includes(sub)) {
        const subPkgPath = path.join(target, sub, 'package.json');
        if (fs.existsSync(subPkgPath)) {
          try {
            const pkg = JSON.parse(fs.readFileSync(subPkgPath, 'utf8'));
            const scripts = pkg.scripts || {};
            const subPm = detectNodePackageManager(path.join(target, sub));
            if (scripts.dev) {
              const runArgs = subPm === 'npm'
                ? ['run', 'dev', '--prefix', sub]
                : (subPm === 'pnpm' ? ['--filter', sub, 'dev'] : ['run', 'dev', '--prefix', sub]);
              return { command: subPm, args: runArgs, type: `${subPm}-dev-${sub}` };
            }
            if (scripts.start) {
              const runArgs = subPm === 'npm'
                ? ['start', '--prefix', sub]
                : (subPm === 'pnpm' ? ['--filter', sub, 'start'] : ['start', '--prefix', sub]);
              return { command: subPm, args: runArgs, type: `${subPm}-start-${sub}` };
            }
          } catch {}
        }
      }
    }

    // 8. Docker Compose (checked only when no native dev runner is detected)
    const composeFiles = ['docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml'];
    const matchedCompose = composeFiles.find(f => files.includes(f));
    if (matchedCompose) {
      return { command: 'docker', args: ['compose', 'up'], type: 'docker-compose' };
    }

    // 9. Makefile without specific run targets
    if (files.includes('Makefile') || files.includes('makefile')) {
      return { command: 'make', args: [], type: 'make' };
    }

    // 10. HTML / static
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
 * Creates a runner script in temporary directory to execute the app command with
 * environment path resolution (virtualenvs, node, local bins).
 * @param {string} projectPath 
 * @param {string} runCommand 
 * @returns {string} Path to created script file
 */
export function prepareAppRunScript(projectPath, runCommand) {
  const tmpDir = os.tmpdir ? os.tmpdir() : '/tmp';
  const timestamp = Date.now();
  const scriptPath = path.join(tmpDir, `run-app-${timestamp}.sh`);

  const fullCmd = runCommand || 'npm run dev';
  const isFallbackBash = fullCmd === 'bash';
  const fallbackNotice = isFallbackBash
    ? `echo -e "\\033[1;33m[Workspace Runner]\\033[0m Nie wykryto automatycznego polecenia startowego w projekcie (brak package.json, python itp.). Uruchomiono powłokę bash."\n`
    : '';

  const scriptContent = `#!/usr/bin/env bash
cd "${projectPath}" || exit 1

# Setup Python virtual environments if present
if [ -d "${projectPath}/.venv/bin" ]; then
  export PATH="${projectPath}/.venv/bin:$PATH"
  export VIRTUAL_ENV="${projectPath}/.venv"
elif [ -d "${projectPath}/venv/bin" ]; then
  export PATH="${projectPath}/venv/bin:$PATH"
  export VIRTUAL_ENV="${projectPath}/venv"
elif [ -d "${projectPath}/backend/.venv/bin" ]; then
  export PATH="${projectPath}/backend/.venv/bin:$PATH"
  export VIRTUAL_ENV="${projectPath}/backend/.venv"
elif [ -d "${projectPath}/backend/venv/bin" ]; then
  export PATH="${projectPath}/backend/venv/bin:$PATH"
  export VIRTUAL_ENV="${projectPath}/backend/venv"
fi

# Ensure user-installed CLI tools are reachable
export PATH="$HOME/.local/bin:$HOME/.cargo/bin:/usr/local/bin:$PATH"

# Ensure Node / NVM if installed
if [ -d "$HOME/.nvm/versions/node" ]; then
  NODE_NVM_DIR="$HOME/.nvm/versions/node/$(ls "$HOME/.nvm/versions/node" 2>/dev/null | tail -n 1)/bin"
  [ -d "$NODE_NVM_DIR" ] && export PATH="$NODE_NVM_DIR:$PATH"
fi

# If executing a shell script, make sure it has +x permissions
if [[ "${fullCmd}" =~ ^bash[[:space:]]+([^[:space:]]+) || "${fullCmd}" =~ ^sh[[:space:]]+([^[:space:]]+) ]]; then
  TARGET_SCRIPT="\${BASH_REMATCH[1]}"
  [ -f "$TARGET_SCRIPT" ] && chmod +x "$TARGET_SCRIPT" 2>/dev/null || true
fi

echo -e "\\033[1;34m[Workspace Runner]\\033[0m Starting application in ${projectPath}..."
echo -e "\\033[1;32m[Command]\\033[0m ${fullCmd}"
${fallbackNotice}echo ""
exec ${fullCmd}
`;

  fs.writeFileSync(scriptPath, scriptContent, { mode: 0o755 });
  return scriptPath;
}

/**
 * Checks if an application in projectPath is already running in the background.
 * @param {string} projectPath
 * @returns {{ isRunning: boolean, pids: number[], ports: number[], mainCommand?: string, url?: string }}
 */
export function checkAppRunning(projectPath) {
  if (!projectPath || typeof projectPath !== 'string') {
    return { isRunning: false, pids: [], ports: [] };
  }

  let target = projectPath.trim().replace(/^["']|["']$/g, '');
  if (target.startsWith('~/')) {
    const home = process.env.HOME || process.env.USERPROFILE || '';
    target = path.join(home, target.slice(2));
  }
  target = path.resolve(target);

  if (!fs.existsSync(target)) {
    return { isRunning: false, pids: [], ports: [] };
  }

  const pids = [];
  let mainCommand = '';

  // 1. Check procfs on Linux / WSL
  if (fs.existsSync('/proc')) {
    try {
      const procEntries = fs.readdirSync('/proc');
      for (const entry of procEntries) {
        if (!/^\d+$/.test(entry)) continue;
        const pidNum = parseInt(entry, 10);
        if (pidNum === process.pid || pidNum === process.ppid) continue;

        try {
          const cwd = fs.readlinkSync(`/proc/${entry}/cwd`);
          if (cwd === target || cwd.startsWith(target + '/')) {
            const cmdline = fs.readFileSync(`/proc/${entry}/cmdline`, 'utf8').replace(/\0/g, ' ').trim();
            // Match server processes even when invoked with absolute paths (e.g. /usr/bin/python3, .venv/bin/uvicorn)
            const isServerProc = /(?:^|\/)(node|bun|pnpm|npm|python[0-9.]*|uvicorn|gunicorn|flask|streamlit|cargo|go|vite|next|tsx|ts-node)\b/i.test(cmdline) ||
              cmdline.includes('server.js') || cmdline.includes('vite') || cmdline.includes('dev') || cmdline.includes('app.main:app');
            const isIgnored = /agentmemory|agy|claude|codex|zsh|bash|git|grep|ss\s+|ps\s+/i.test(cmdline);

            if (isServerProc && !isIgnored) {
              pids.push(pidNum);
              if (!mainCommand) mainCommand = cmdline.slice(0, 80);
            }
          }
        } catch {}
      }
    } catch {}
  }

  // 2. Find listening ports for these PIDs (supporting multiple PIDs per socket)
  const ports = [];
  if (pids.length > 0) {
    try {
      const pidSet = new Set(pids);
      const out = execSync('ss -tlpn 2>/dev/null', { encoding: 'utf8' });
      for (const line of out.split('\n')) {
        const pidsInLine = [...line.matchAll(/pid=(\d+)/g)].map(m => parseInt(m[1], 10));
        if (pidsInLine.some(pid => pidSet.has(pid))) {
          const portMatch = line.match(/:(\d+)\s+/);
          if (portMatch) {
            ports.push(parseInt(portMatch[1], 10));
          }
        }
      }
    } catch {}
  }

  // 3. Check Docker Compose if compose file is present and running
  const composeFiles = ['docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml'];
  const hasCompose = composeFiles.some(f => fs.existsSync(path.join(target, f)));
  if (hasCompose) {
    try {
      const out = execSync('docker compose ps --status running -q 2>/dev/null', { cwd: target, encoding: 'utf8' });
      if (out.trim().length > 0) {
        return {
          isRunning: true,
          pids,
          ports: [...new Set(ports)],
          mainCommand: 'docker compose',
          url: ports[0] ? `http://localhost:${ports[0]}` : undefined
        };
      }
    } catch {}
  }

  const uniquePorts = [...new Set(ports)];
  const isRunning = pids.length > 0;
  const primaryPort = uniquePorts.find(p => p !== 3003 && p !== 1234) || uniquePorts[0];
  const url = primaryPort ? `http://localhost:${primaryPort}` : undefined;

  return {
    isRunning,
    pids,
    ports: uniquePorts,
    mainCommand: mainCommand || undefined,
    url
  };
}

/**
 * Stops running application processes associated with projectPath and frees occupied ports.
 * @param {string} projectPath
 * @returns {{ success: boolean, killedPids: number[], message: string }}
 */
export function stopApp(projectPath) {
  if (!projectPath || typeof projectPath !== 'string') {
    return { success: false, killedPids: [], message: 'Brak ścieżki projektu' };
  }

  const target = path.resolve(projectPath.trim().replace(/^["']|["']$/g, ''));
  const status = checkAppRunning(target);
  const killed = [];

  for (const pid of status.pids) {
    try {
      process.kill(pid, 'SIGTERM');
      killed.push(pid);
    } catch {}
  }

  // Docker Compose shutdown if applicable
  const composeFiles = ['docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml'];
  if (composeFiles.some(f => fs.existsSync(path.join(target, f)))) {
    try {
      execSync('docker compose down 2>/dev/null', { cwd: target, encoding: 'utf8' });
    } catch {}
  }

  // Free listening ports via fuser if available
  for (const port of status.ports) {
    try {
      execSync(`fuser -k ${port}/tcp 2>/dev/null`, { encoding: 'utf8' });
    } catch {}
  }

  // Ensure stubborn processes are killed with SIGKILL
  for (const pid of killed) {
    try {
      process.kill(pid, 0);
      process.kill(pid, 'SIGKILL');
    } catch {}
  }

  return {
    success: true,
    killedPids: killed,
    message: killed.length > 0
      ? `Zatrzymano aplikację (zakończono ${killed.length} procesów)`
      : 'Aplikacja nie była uruchomiona'
  };
}
