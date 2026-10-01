import { io } from 'socket.io-client';
import pty from 'node-pty';
import os from 'os';
import fs from 'fs';
import path from 'path';

function sanitizeToken(raw) {
  if (!raw) return raw;
  raw = String(raw).trim().replace(/^['"]|['"]$/g, '');
  const idx = raw.lastIndexOf('eyJhbGci');
  if (idx > 0) {
    const candidate = raw.slice(idx);
    const parts = candidate.split('.');
    if (parts.length === 3) {
      console.log('🧹 Wykryto zduplikowany/sklejony token ze schowka, automatycznie oczyszczono do poprawnego JWT.');
      return candidate;
    }
  }
  return raw;
}

const SERVER_URL = (process.env.DASHBOARD_SERVER_URL || process.argv[2] || 'http://localhost:3001').trim();
const AUTH_TOKEN = sanitizeToken(process.env.DASHBOARD_TOKEN || process.argv[3] || 'fallback-super-secret-key-123');
const WORKER_NAME = process.env.WORKER_NAME || process.argv[4] || os.hostname() || 'Local-Workstation';

console.log(`🚀 Starting Local Agent Worker...`);
console.log(`📡 Connecting to Remote Dashboard at: ${SERVER_URL}`);
console.log(`🏷️  Worker Name: ${WORKER_NAME}`);

function findShellExecutable(requestedCmd) {
  if (requestedCmd && requestedCmd !== 'bash' && fs.existsSync(requestedCmd)) {
    return requestedCmd;
  }

  if (process.platform === 'win32') {
    const gitBashCandidates = [
      'C:\\Program Files\\Git\\bin\\bash.exe',
      'C:\\Program Files\\Git\\usr\\bin\\bash.exe',
      'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
      path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Git', 'bin', 'bash.exe'),
    ];

    for (const bashPath of gitBashCandidates) {
      if (fs.existsSync(bashPath)) {
        return bashPath;
      }
    }

    return process.env.COMSPEC || 'cmd.exe';
  }

  return requestedCmd || 'bash';
}

const socket = io(SERVER_URL, {
  auth: {
    token: AUTH_TOKEN,
    isWorker: true,
    workerName: WORKER_NAME,
    hostname: os.hostname(),
    platform: process.platform
  },
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 2000
});

const activeSessions = new Map(); // sessionId -> ptyProcess

socket.on('connect', () => {
  console.log(`✅ Connected to Remote Dashboard (Socket ID: ${socket.id})`);
  socket.emit('register_worker', {
    workerId: socket.id,
    name: WORKER_NAME,
    hostname: os.hostname(),
    platform: process.platform,
    arch: os.arch(),
    uptime: os.uptime()
  });
});

socket.on('disconnect', (reason) => {
  console.warn(`⚠️ Disconnected from Remote Dashboard: ${reason}`);
  for (const ptyProc of activeSessions.values()) {
    try {
      ptyProc.kill();
    } catch {}
  }
  activeSessions.clear();
});

socket.on('connect_error', (err) => {
  console.error(`❌ Connection error: ${err.message}`);
});

socket.on('worker_spawn_pty', ({ sessionId, command, args, cwd, env, scriptContent }) => {
  console.log(`⚡ Spawning PTY session ${sessionId} for command: ${command || 'default shell'}`);
  try {
    const shellCmd = findShellExecutable(command);
    let finalArgs = args ? [...args] : [];
    let targetCwd = (cwd && fs.existsSync(cwd)) ? cwd : process.cwd();

    if (scriptContent) {
      let scriptTarget = path.join(targetCwd, '.start_agent.sh');
      try {
        fs.writeFileSync(scriptTarget, scriptContent);
        fs.chmodSync(scriptTarget, '755');
      } catch {
        scriptTarget = path.join(os.tmpdir(), `.start_agent_${sessionId}.sh`);
        fs.writeFileSync(scriptTarget, scriptContent);
        fs.chmodSync(scriptTarget, '755');
      }
      finalArgs = [scriptTarget];
    } else if (finalArgs.length > 0 && typeof finalArgs[0] === 'string' && finalArgs[0].endsWith('.start_agent.sh') && !fs.existsSync(finalArgs[0])) {
      const localCandidate = path.join(process.cwd(), '.start_agent.sh');
      if (fs.existsSync(localCandidate)) {
        finalArgs = [localCandidate];
      }
    }

    const userHome = process.env.USERPROFILE || process.env.HOME || os.homedir();
    const extendedPath = process.platform === 'win32'
      ? [
        path.join(userHome, 'AppData\\Local\\agy\\bin'),
        path.join(userHome, 'AppData\\Local\\JetBrains\\Air\\node-24.13.0\\node-v24.13.0-win-x64'),
        path.join(userHome, 'AppData\\Local\\nvm\\v20.20.0'),
        'C:\\Program Files\\Git\\bin',
        'C:\\Program Files\\Git\\usr\\bin',
        process.env.PATH || ''
      ].join(';')
      : [
        path.join(userHome, '.local/bin'),
        path.join(userHome, '.cargo/bin'),
        '/usr/local/bin',
        process.env.PATH || ''
      ].join(':');

    const ptyProcess = pty.spawn(shellCmd, finalArgs, {
      name: 'xterm-256color',
      cols: 100,
      rows: 30,
      cwd: targetCwd,
      env: {
        ...process.env,
        ...env,
        PATH: extendedPath,
        COLUMNS: '100',
        LINES: '30',
        TERM: 'xterm-256color'
      },
      useConpty: false
    });

    activeSessions.set(sessionId, ptyProcess);

    ptyProcess.onData((data) => {
      socket.emit('worker_terminal_data', { sessionId, data });
    });

    ptyProcess.onExit(({ exitCode, signal }) => {
      console.log(`🏁 Session ${sessionId} exited with code ${exitCode}`);
      socket.emit('worker_terminal_exit', { sessionId, exitCode, signal });
      activeSessions.delete(sessionId);
    });

  } catch (err) {
    console.error(`❌ Failed to spawn PTY for session ${sessionId}:`, err);
    socket.emit('worker_terminal_error', { sessionId, message: err.message });
  }
});

socket.on('worker_terminal_input', ({ sessionId, data }) => {
  const ptyProc = activeSessions.get(sessionId);
  if (ptyProc) {
    try {
      ptyProc.write(data);
    } catch  {}
  }
});

socket.on('worker_terminal_resize', ({ sessionId, cols, rows }) => {
  const ptyProc = activeSessions.get(sessionId);
  if (ptyProc) {
    try {
      ptyProc.resize(cols, rows);
    } catch  {}
  }
});

socket.on('worker_kill_pty', ({ sessionId }) => {
  const ptyProc = activeSessions.get(sessionId);
  if (ptyProc) {
    try {
      ptyProc.kill();
    } catch  {}
    activeSessions.delete(sessionId);
  }
});

export default socket;
