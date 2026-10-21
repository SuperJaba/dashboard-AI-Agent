/* global PhusionPassenger */
if (typeof PhusionPassenger !== 'undefined') {
  PhusionPassenger.configure({ autoInstall: false });
}

import express from 'express';
import fs from 'fs';
import path from 'path';

import fetch from 'node-fetch';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import pty from 'node-pty';

import jwt from 'jsonwebtoken';
import { pool } from './src/backend/db.js';
import { authRouter } from './src/backend/auth/authRouter.js';
import { authMiddleware } from './src/backend/auth/authMiddleware.js';
import { logger, requestLogger } from './src/backend/utils/logger.js';
import { register, metricsMiddleware, activeAgentWorkers } from './src/backend/metrics.js';


import { JWT_SECRET } from './src/backend/auth/jwtSecret.js';

import net from 'net';
import { settingsRouter } from './src/backend/settings/settingsRouter.js';
import { getWslHostIp, projectsRouter } from './src/backend/projects/projectsRouter.js';
import { serversRouter } from './src/backend/servers/serversRouter.js';

// Setup transparent local LM Studio proxy for WSL localhost:1234 -> host:1234
function startLlmBridge() {
  if (process.platform !== 'linux') return;
  const wslIp = getWslHostIp();
  if (!wslIp) return;

  const bridge = net.createServer((clientSocket) => {
    const targetSocket = net.connect(1234, wslIp);
    clientSocket.pipe(targetSocket);
    targetSocket.pipe(clientSocket);
    targetSocket.on('error', () => clientSocket.destroy());
    clientSocket.on('error', () => targetSocket.destroy());
  });

  bridge.on('error', () => {
    // Port 1234 may already be bound or in use, which is expected
  });

  bridge.listen(1234, '127.0.0.1', () => {
    console.log(`📡 Localhost LM Studio bridge active: 127.0.0.1:1234 -> ${wslIp}:1234`);
  });
}
startLlmBridge();

// Import background worker and start it.
import { startBackgroundWorker } from './src/backend/agents/backgroundWorker.js';
import { startRemoteSyncCron } from './src/backend/scripts/remoteSyncCron.js';
import { widgetsRouter } from './src/backend/widgets/widgetsRouter.js';
import { agentsRouter } from './src/backend/agents/agentsRouter.js';
import { llmServersRouter } from './src/backend/llmServers/llmServersRouter.js';
import { userSettingsRouter } from './src/backend/settings/userSettingsRouter.js';
import { webhooksRouter } from './src/backend/webhooks/webhooksRouter.js';
import { alertsRouter } from './src/backend/alerts/alertsRouter.js';
import { startAlertWatcher } from './src/backend/alerts/alertWatcher.js';
import { sseRouter } from './src/backend/events/sseRouter.js';
import { kpiRouter } from './src/backend/analytics/kpiRouter.js';
import { registerPtyNamespace } from './src/backend/socket/ptyNamespace.js';
import { registerDashboardNamespace } from './src/backend/socket/dashboardNamespace.js';
export { emitDashboardNotification, emitAgentEvent } from './src/backend/socket/dashboardNamespace.js';
import { createSocketAuthMiddleware } from './src/backend/socket/socketAuth.js';

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isTestEnvironment = process.env.NODE_ENV === 'test';
dotenv.config();
if (isTestEnvironment) {
  process.env.NODE_ENV = 'test';
}

const app = express();

const port = process.env.PORT || 3001;

// Prometheus registry and metrics defined in src/backend/metrics.js


const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  transports: ['polling', 'websocket']
});

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

export const activeWorkers = new Map();

// Socket.io authentication middleware
const socketAuthMiddleware = createSocketAuthMiddleware(JWT_SECRET);
io.use(socketAuthMiddleware);

io.on('connection', (socket) => {
  const isWorker = socket.handshake.auth?.isWorker;

  if (isWorker) {
    const workerInfo = {
      id: socket.id,
      name: socket.handshake.auth?.workerName || 'Local Worker',
      hostname: socket.handshake.auth?.hostname || 'unknown',
      platform: socket.handshake.auth?.platform || 'unknown',
      connectedAt: new Date().toISOString(),
      socket
    };
    activeWorkers.set(socket.id, workerInfo);
    activeAgentWorkers.set(activeWorkers.size);
    logger.info({ workerId: socket.id, name: workerInfo.name }, '🤖 Registered Local Agent Worker');

    socket.on('register_worker', (data) => {
      if (activeWorkers.has(socket.id)) {
        const existing = activeWorkers.get(socket.id);
        Object.assign(existing, data);
      }
    });

    socket.on('worker_terminal_data', ({ sessionId, data }) => {
      const clientSocket = io.sockets.sockets.get(sessionId);
      if (clientSocket) {
        clientSocket.emit('terminal_data', data);
      }
    });

    socket.on('worker_terminal_exit', ({ sessionId, exitCode, signal }) => {
      const clientSocket = io.sockets.sockets.get(sessionId);
      if (clientSocket) {
        clientSocket.emit('terminal_exit', { exitCode, signal });
      }
    });

    socket.on('worker_terminal_error', ({ sessionId, message }) => {
      const clientSocket = io.sockets.sockets.get(sessionId);
      if (clientSocket) {
        clientSocket.emit('terminal_error', message);
      }
    });

    socket.on('disconnect', () => {
      activeWorkers.delete(socket.id);
      activeAgentWorkers.set(activeWorkers.size);
      logger.info({ workerId: socket.id }, '🤖 Unregistered Local Agent Worker');
    });

    return;
  }

  // Regular browser client session
  let ptyProcess = null;
  let activeWorkerSocket = null;

  socket.on('spawn_terminal', ({ command, args, cwd, env, executionTarget, targetWorkerId, scriptContent }) => {
    let workerToUse = null;
    if (targetWorkerId && activeWorkers.has(targetWorkerId)) {
      workerToUse = activeWorkers.get(targetWorkerId);
    } else if (executionTarget === 'worker' || (executionTarget !== 'remote' && activeWorkers.size > 0)) {
      workerToUse = Array.from(activeWorkers.values())[0];
    }

    if (workerToUse) {
      activeWorkerSocket = workerToUse.socket;
      console.log(`Forwarding terminal spawn for session ${socket.id} to Local Worker ${workerToUse.name}`);
      activeWorkerSocket.emit('worker_spawn_pty', {
        sessionId: socket.id,
        command,
        args,
        cwd,
        env,
        scriptContent
      });
      return;
    }

    // Default remote execution
    try {
      const shellCmd = findShellExecutable(command);
      const targetCwd = (cwd && fs.existsSync(cwd)) ? cwd : process.cwd();

      const userHome = process.env.USERPROFILE || process.env.HOME || 'C:\\Users\\picho';
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

      const sanitizedEnv = { ...(env || {}) };
      delete sanitizedEnv.HOME;
      delete sanitizedEnv.USER;
      delete sanitizedEnv.LOGNAME;
      delete sanitizedEnv.USERPROFILE;

      ptyProcess = pty.spawn(shellCmd, args || [], {
        name: 'xterm-256color',
        cols: 100,
        rows: 30,
        cwd: targetCwd,
        env: { 
          ...process.env, 
          ...sanitizedEnv, 
          PATH: extendedPath,
          COLUMNS: '100',
          LINES: '30',
          TERM: 'xterm-256color'
        },
        useConpty: false
      });

      ptyProcess.onData((data) => {
        socket.emit('terminal_data', data);
      });

      ptyProcess.onExit(({ exitCode, signal }) => {
        socket.emit('terminal_exit', { exitCode, signal });
      });
    } catch (err) {
      console.error('PTY spawn error:', err);
      socket.emit('terminal_error', err.message);
    }
  });

  socket.on('terminal_input', (data) => {
    // Normalize Kitty keyboard protocol Enter sequences (\x1b[13;...u or [13;...u) to \r
    const cleanData = typeof data === 'string'
      ? data.replace(new RegExp(String.fromCharCode(27) + '\\[13;[0-9;]+u', 'g'), '\r').replace(/\[13;[0-9;]+u/g, '\r')
      : data;
    if (activeWorkerSocket) {
      activeWorkerSocket.emit('worker_terminal_input', { sessionId: socket.id, data: cleanData });
    } else if (ptyProcess) {
      try {
        ptyProcess.write(cleanData);
      } catch  {}
    }
  });

  socket.on('terminal_resize', ({ cols, rows }) => {
    if (activeWorkerSocket) {
      activeWorkerSocket.emit('worker_terminal_resize', { sessionId: socket.id, cols, rows });
    } else if (ptyProcess) {
      try {
        ptyProcess.resize(cols, rows);
      } catch  {}
    }
  });

  socket.on('disconnect', () => {
    if (activeWorkerSocket) {
      activeWorkerSocket.emit('worker_kill_pty', { sessionId: socket.id });
      activeWorkerSocket = null;
    }
    if (ptyProcess) {
      try {
        ptyProcess.kill();
      } catch  {}
      ptyProcess = null;
    }
  });
});

// T2.2 — Dedicated Socket.IO Namespaces
export const ptyNsp = io.of('/pty');
export const dashNsp = io.of('/dashboard');

ptyNsp.use(socketAuthMiddleware);
dashNsp.use(socketAuthMiddleware);

registerPtyNamespace(ptyNsp, activeWorkers);
registerDashboardNamespace(dashNsp, activeWorkers);


app.use(cors());
app.use(express.json());
app.use(requestLogger);
app.use(metricsMiddleware);
// Serve static assets from the public directory
app.use(express.static('public'));


// T7.2 — Legacy health check (kept for backward compat)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// T7.2 — Liveness probe: process is responsive
app.get('/health/live', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// T7.2 — Readiness probe: DB connectivity check
app.get('/health/ready', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected', timestamp: new Date().toISOString() });
  } catch (err) {
    logger.warn({ err: err.message }, 'Readiness probe: DB not reachable');
    res.status(503).json({ status: 'unavailable', db: 'disconnected', timestamp: new Date().toISOString() });
  }
});


// Prometheus metrics endpoint
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (ex) {
    res.status(500).end(ex);
  }
});

// Proxy llama-server metrics
app.get('/v1/metrics', async (req, res) => {
  const model = req.query.model;
  if (!model) {
    return res.status(400).json({ error: 'Missing model query parameter' });
  }
  try {
    const response = await fetch(`http://127.0.0.1:1337/v1/metrics?model=${model}`);
    const body = await response.text();
    res.set('Content-Type', response.headers.get('content-type') || 'text/plain');
    res.status(response.status).send(body);
  } catch (err) {
    res.status(502).json({ error: 'Failed to proxy metrics', details: err.message });
  }
});

// --- Auth Routes ---
app.use('/api/auth', authRouter);

// API Auth Middleware
app.use('/api', authMiddleware);

app.get('/api/agents/workers', (req, res) => {
  const workers = Array.from(activeWorkers.values()).map(w => ({
    id: w.id,
    name: w.name,
    hostname: w.hostname,
    platform: w.platform,
    connectedAt: w.connectedAt
  }));
  res.json(workers);
});

app.get('/api/socket-info', (req, res) => {
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.get('host') || `localhost:${port}`;
  const serverUrl = `${protocol}://${host}`;

  let token = '';
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    token = jwt.sign(
      { id: req.user?.id || 1, username: req.user?.username || 'worker-client', isWorker: true },
      JWT_SECRET,
      { expiresIn: '30d' }
    );
  }

  const workers = Array.from(activeWorkers.values()).map(w => ({
    id: w.id,
    name: w.name,
    hostname: w.hostname,
    platform: w.platform,
    connectedAt: w.connectedAt
  }));

  res.json({
    serverUrl,
    token,
    workers,
    workersCount: workers.length,
    commands: {
      npm: `DASHBOARD_SERVER_URL="${serverUrl}" DASHBOARD_TOKEN="${token}" npm run agent:worker`,
      node: `node scripts/local-agent-worker.js ${serverUrl} "${token}" "Moj-PC"`,
      bash: `export DASHBOARD_SERVER_URL="${serverUrl}"\nexport DASHBOARD_TOKEN="${token}"\nnpm run agent:worker`,
      powershell: `$env:DASHBOARD_SERVER_URL="${serverUrl}"\n$env:DASHBOARD_TOKEN="${token}"\nnpm run agent:worker`
    }
  });
});

app.post('/api/socket/token', (req, res) => {
  const user = req.user || { id: 1, username: 'worker-client' };
  const workerToken = jwt.sign(
    { id: user.id || 1, username: user.username || 'worker-client', isWorker: true },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
  res.json({ success: true, token: workerToken, expiresIn: '30d' });
});


// --- Modular Endpoints ---
app.use('/api/settings', settingsRouter);
app.use('/api', projectsRouter);
app.use('/api', serversRouter);
app.use('/api/widgets', widgetsRouter);
app.use('/api/agents', agentsRouter);
app.use('/api', llmServersRouter);
app.use('/api/user-settings', userSettingsRouter);
app.use('/api/webhooks', webhooksRouter);
app.use('/api/alerts', authMiddleware, alertsRouter);
app.use('/api/events', authMiddleware, sseRouter);
app.use('/api/analytics', authMiddleware, kpiRouter);

// T7.4 — Start alert watcher (skipped in test env)
if (process.env.NODE_ENV !== 'test') {
  startAlertWatcher();
}


// Serve built frontend static assets if available (dist or public)
const staticDist = path.join(__dirname, 'dist');
const staticPublic = path.join(__dirname, 'public');
const staticPath = fs.existsSync(staticDist) ? staticDist : (fs.existsSync(staticPublic) ? staticPublic : null);

if (staticPath) {
  app.use(express.static(staticPath));
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/socket.io')) {
      return res.sendFile(path.join(staticPath, 'index.html'));
    }
    next();
  });
}

// Init DB
async function initDB() {
  try {
    const schema = process.env.DB_SCHEMA || 'dashboard';
    await pool.query(`CREATE SCHEMA IF NOT EXISTS ${schema};`);
    await pool.query(`SET search_path TO ${schema}, public;`);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS settings (
        id SERIAL PRIMARY KEY,
        key VARCHAR(255) UNIQUE NOT NULL,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS llm_servers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        url VARCHAR(512) NOT NULL,
        api_key TEXT,
        model VARCHAR(255),
        provider VARCHAR(255) DEFAULT 'Custom',
        is_active BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        "desc" TEXT,
        path TEXT NOT NULL,
        branch VARCHAR(255) DEFAULT 'main',
        tech VARCHAR(255) DEFAULT 'Unknown',
        complete INTEGER DEFAULT 0,
        tasks JSONB DEFAULT '[]'::jsonb
      );
      CREATE TABLE IF NOT EXISTS servers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        host VARCHAR(255) NOT NULL,
        username VARCHAR(255) NOT NULL,
        port INTEGER DEFAULT 22,
        use_devil BOOLEAN DEFAULT false,
        ssh_password TEXT
      );
      ALTER TABLE servers ADD COLUMN IF NOT EXISTS use_devil BOOLEAN DEFAULT false;
      ALTER TABLE servers ADD COLUMN IF NOT EXISTS ssh_password TEXT;
      CREATE TABLE IF NOT EXISTS cli_agents (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        description TEXT,
        path VARCHAR(255),
        config_uri TEXT,
        installed BOOLEAN DEFAULT false
      );
      ALTER TABLE cli_agents ADD COLUMN IF NOT EXISTS llm_model VARCHAR(255);
      ALTER TABLE cli_agents ADD COLUMN IF NOT EXISTS temperature NUMERIC DEFAULT 0.7;
      ALTER TABLE cli_agents ADD COLUMN IF NOT EXISTS max_tokens INTEGER DEFAULT 4096;
      CREATE TABLE IF NOT EXISTS custom_widgets (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        command TEXT NOT NULL,
        type VARCHAR(50) DEFAULT 'number',
        color VARCHAR(50) DEFAULT '#c084fc',
        server_id INTEGER
      );
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS user_settings (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        theme VARCHAR(20) DEFAULT 'dark',
        language VARCHAR(10) DEFAULT 'pl',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS agents (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        description TEXT,
        server_id INTEGER REFERENCES servers(id),
        status VARCHAR(50) DEFAULT 'stopped',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO settings (key, value) VALUES ('llmName', 'AtomicChat') ON CONFLICT (key) DO NOTHING;
      INSERT INTO settings (key, value) VALUES ('llmUrl', 'http://127.0.0.1:1337/v1') ON CONFLICT (key) DO NOTHING;
      INSERT INTO settings (key, value) VALUES ('llmModel', 'AtomicChat/qwen35-4b-Q8_0') ON CONFLICT (key) DO NOTHING;
    `);
    console.log(`Database initialized in schema '${schema}'`);
  } catch (err) {
    console.error('Failed to initialize database:', err.message);
  }
}
initDB();

const isPassenger = typeof PhusionPassenger !== 'undefined' || !!process.env.PASSENGER_APP_ENV;

if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
  if (isPassenger) {
    httpServer.listen('passenger', () => {
      console.log('Backend API and Socket.IO running under Phusion Passenger');
      try {
        startBackgroundWorker();
        startRemoteSyncCron();
      } catch (e) {
        logger.warn({ err: e.message }, 'Failed to start background worker or remote sync cron');
      }
    });
  } else {
    httpServer.listen(port, () => {
      logger.info(`Backend API running on http://localhost:${port}`);
      logger.info(`Prometheus metrics available at http://localhost:${port}/metrics`);
      try {
        startBackgroundWorker();
        startRemoteSyncCron();
      } catch (e) {
        logger.warn({ err: e.message }, 'Failed to start background worker or remote sync cron');
      }
    });
  }
}

export { app, httpServer };
export default app;
