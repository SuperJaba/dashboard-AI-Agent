import express from 'express';
import client from 'prom-client';
import fetch from 'node-fetch';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import pty from 'node-pty';

import { pool } from './src/backend/db.js';
import { authRouter } from './src/backend/auth/authRouter.js';
import { authMiddleware } from './src/backend/auth/authMiddleware.js';

import { settingsRouter } from './src/backend/settings/settingsRouter.js';
import { projectsRouter } from './src/backend/projects/projectsRouter.js';
import { serversRouter } from './src/backend/servers/serversRouter.js';
import { widgetsRouter } from './src/backend/widgets/widgetsRouter.js';
import { agentsRouter } from './src/backend/agents/agentsRouter.js';

dotenv.config();

const app = express();
const port = 3001;

// Initialize Prometheus client
const register = new client.Registry();
client.collectDefaultMetrics({ register });

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
  }
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

io.on('connection', (socket) => {
  let ptyProcess = null;

  socket.on('spawn_terminal', ({ command, args, cwd, env }) => {
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

      ptyProcess = pty.spawn(shellCmd, args || [], {
        name: 'xterm-color',
        cols: 80,
        rows: 24,
        cwd: targetCwd,
        env: { ...process.env, ...env, PATH: extendedPath }
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
    if (ptyProcess) {
      ptyProcess.write(data);
    }
  });

  socket.on('terminal_resize', ({ cols, rows }) => {
    if (ptyProcess) {
      try {
        ptyProcess.resize(cols, rows);
      } catch (e) {}
    }
  });

  socket.on('disconnect', () => {
    if (ptyProcess) {
      ptyProcess.kill();
    }
  });
});

app.use(cors());
app.use(express.json());
// Serve static assets from the public directory
app.use(express.static('public'));

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

// --- Modular Endpoints ---
app.use('/api/settings', settingsRouter);
app.use('/api', projectsRouter);
app.use('/api', serversRouter);
app.use('/api/widgets', widgetsRouter);
app.use('/api/agents', agentsRouter);

// Init DB
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS settings (
        id SERIAL PRIMARY KEY,
        key VARCHAR(255) UNIQUE NOT NULL,
        value TEXT NOT NULL
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
      INSERT INTO settings (key, value) VALUES ('llmName', 'AtomicChat') ON CONFLICT (key) DO NOTHING;
      INSERT INTO settings (key, value) VALUES ('llmUrl', 'http://127.0.0.1:1337/v1') ON CONFLICT (key) DO NOTHING;
      INSERT INTO settings (key, value) VALUES ('llmModel', 'AtomicChat/qwen35-4b-Q8_0') ON CONFLICT (key) DO NOTHING;
    `);
    console.log('Database initialized');
  } catch (err) {
    console.error('Failed to initialize database:', err.message);
  }
}
initDB();

if (process.env.NODE_ENV !== 'test') {
  httpServer.listen(port, () => {
    console.log(`Backend API running on http://localhost:${port}`);
    console.log(`Prometheus metrics available at http://localhost:${port}/metrics`);
  });
}

export default app;
