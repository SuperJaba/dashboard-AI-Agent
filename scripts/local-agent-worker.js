import { io } from 'socket.io-client';
import pty from 'node-pty';
import os from 'os';
import fs from 'fs';
import path from 'path';

const SERVER_URL = process.env.DASHBOARD_SERVER_URL || process.argv[2] || 'http://localhost:3001';
const AUTH_TOKEN = process.env.DASHBOARD_TOKEN || process.argv[3] || 'fallback-super-secret-key-123';
const WORKER_NAME = process.env.WORKER_NAME || os.hostname() || 'Local-Workstation';

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

socket.on('worker_spawn_pty', ({ sessionId, command, args, cwd, env }) => {
  console.log(`⚡ Spawning PTY session ${sessionId} for command: ${command || 'default shell'}`);
  try {
    const shellCmd = findShellExecutable(command);
    const targetCwd = (cwd && fs.existsSync(cwd)) ? cwd : process.cwd();

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
      : process.env.PATH;

    const ptyProcess = pty.spawn(shellCmd, args || [], {
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
