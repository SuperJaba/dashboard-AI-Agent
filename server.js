import express from 'express';
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

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
  }
});

io.on('connection', (socket) => {
  let ptyProcess = null;

  socket.on('spawn_terminal', ({ command, args, cwd, env }) => {
    try {
      ptyProcess = pty.spawn(command, args || [], {
        name: 'xterm-color',
        cols: 80,
        rows: 24,
        cwd: cwd || process.cwd(),
        env: { ...process.env, ...env }
      });

      ptyProcess.onData((data) => {
        socket.emit('terminal_data', data);
      });

      ptyProcess.onExit(({ exitCode, signal }) => {
        socket.emit('terminal_exit', { exitCode, signal });
      });
    } catch (err) {
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
  });
}

export default app;
