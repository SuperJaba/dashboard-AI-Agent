import express from 'express';
import os from 'os';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import cors from 'cors';
import { spawn, exec, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import pkg from 'pg';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import pty from 'node-pty';

import { pool } from './src/backend/db.js';
import { authRouter } from './src/backend/auth/authRouter.js';
import { authMiddleware } from './src/backend/auth/authMiddleware.js';

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

// Crypto Helpers for API Keys
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex'); // Must be 256 bits (32 characters)
const IV_LENGTH = 16;

function encrypt(text) {
  if (!text) return text;
  let iv = crypto.randomBytes(IV_LENGTH);
  let cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.slice(0, 32)), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text) {
  if (!text) return text;
  let textParts = text.split(':');
  let iv = Buffer.from(textParts.shift(), 'hex');
  let encryptedText = Buffer.from(textParts.join(':'), 'hex');
  let decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.slice(0, 32)), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

// Helper: buduje bazowy ciąg komendy SSH — klucz lub hasło
function sshCmd(s, remoteCmd) {
  const pass = s.ssh_password ? decrypt(s.ssh_password) : null;
  const base = pass
    ? `sshpass -p ${JSON.stringify(pass)} ssh -o StrictHostKeyChecking=accept-new -o PasswordAuthentication=yes -o BatchMode=no -p ${s.port} ${s.username}@${s.host}`
    : `ssh -i ~/.ssh/id_ed25519_antigravity -o StrictHostKeyChecking=accept-new -o BatchMode=yes -p ${s.port} ${s.username}@${s.host}`;
  return remoteCmd ? `${base} ${remoteCmd}` : base;
}

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

// --- Endpoints ---

// Get Settings (LLM URL, API KEY)
app.get('/api/settings', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT key, value FROM settings');
    const settings = {};
    for (let row of rows) {
      if (row.key === 'apiKey') settings[row.key] = decrypt(row.value);
      else settings[row.key] = row.value;
    }
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save Settings
app.post('/api/settings', async (req, res) => {
  const { llmUrl, apiKey, useBrowserTerminal } = req.body;
  try {
    if (llmUrl !== undefined) {
      await pool.query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', ['llmUrl', llmUrl]);
    }
    if (apiKey !== undefined) {
      await pool.query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', ['apiKey', encrypt(apiKey)]);
    }
    if (useBrowserTerminal !== undefined) {
      await pool.query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', ['useBrowserTerminal', String(useBrowserTerminal)]);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Projects
app.get('/api/projects', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM projects ORDER BY id ASC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/projects/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM projects WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Servers API
app.get('/api/servers', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM servers ORDER BY id ASC');
    // Nie ujawniaj zaszyfrowanego hasła — zamień na flagę has_password
    const safe = rows.map(r => ({ ...r, ssh_password: undefined, has_password: !!r.ssh_password }));
    res.json(safe);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/servers', async (req, res) => {
  const { name, host, username, port, use_devil, ssh_password } = req.body;
  try {
    const encPass = ssh_password ? encrypt(ssh_password) : null;
    const { rows } = await pool.query(
      'INSERT INTO servers (name, host, username, port, use_devil, ssh_password) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [name, host, username, port || 22, use_devil === true, encPass]
    );
    // Nie zwracaj zaszyfrowanego hasła do frontendu
    const row = { ...rows[0], ssh_password: undefined, has_password: !!encPass };
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/servers/:id', async (req, res) => {
  const { name, host, username, port, use_devil, ssh_password } = req.body;
  try {
    const encPass = ssh_password !== undefined ? (ssh_password ? encrypt(ssh_password) : null) : undefined;
    const fields = ['name=$2','host=$3','username=$4','port=$5','use_devil=$6'];
    const vals = [req.params.id, name, host, username, port || 22, use_devil === true];
    if (encPass !== undefined) { fields.push(`ssh_password=$${vals.length + 1}`); vals.push(encPass); }
    const { rows } = await pool.query(
      `UPDATE servers SET ${fields.join(',')} WHERE id=$1 RETURNING *`, vals
    );
    const row = { ...rows[0], ssh_password: undefined, has_password: !!rows[0].ssh_password };
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/servers/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM servers WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CLI Agents API
app.get('/api/agents', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM cli_agents ORDER BY name ASC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/agents/scan', async (req, res) => {
  try {
    const agentsToScan = [
      { name: 'Claude Code', cmd: 'claude', desc: 'Anthropic Claude Code CLI' },
      { name: 'Codex', cmd: 'codex', desc: 'OpenAI Codex CLI' },
      { name: 'Antigravity', cmd: 'agy', desc: 'Google AI Antigravity CLI' },
      { name: 'Aider', cmd: 'aider', desc: 'Aider AI pair programming' }
    ];
    
    let found = [];
    for (const agent of agentsToScan) {
      try {
        const stdout = execSync(`which ${agent.cmd}`, { encoding: 'utf8' }).trim();
        if (stdout) {
          // Auto-discover config files
          let configUri = '';
          const home = process.env.HOME || process.env.USERPROFILE;
          if (agent.cmd === 'claude') configUri = `${home}/.claude.json`;
          else if (agent.cmd === 'codex') configUri = `${home}/.codex/config.json`;
          else if (agent.cmd === 'agy') configUri = `${home}/.gemini/config.json`;
          else if (agent.cmd === 'aider') configUri = `${home}/.aider.conf.yml`;

          // Verify if config exists
          if (configUri && !fs.existsSync(configUri)) {
            configUri = '';
          }

          const existing = await pool.query('SELECT id FROM cli_agents WHERE name = $1', [agent.name]);
          if (existing.rows.length === 0) {
            await pool.query(
              'INSERT INTO cli_agents (name, description, path, config_uri, installed) VALUES ($1, $2, $3, $4, true)',
              [agent.name, agent.desc, stdout, configUri]
            );
          } else {
            // Update if empty, otherwise preserve user's custom config_uri
            await pool.query(
              'UPDATE cli_agents SET path = $1, config_uri = COALESCE(NULLIF(config_uri, \'\'), $2), installed = true WHERE name = $3',
              [stdout, configUri, agent.name]
            );
          }
          found.push(agent.name);
        }
      } catch (e) {
        // Not found or error
      }
    }
    res.json({ success: true, found });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/agents/:id', async (req, res) => {
  const { config_uri, name, description, path: binPath, llm_model, temperature, max_tokens } = req.body;
  try {
    let query = 'UPDATE cli_agents SET config_uri = $1';
    let values = [config_uri];
    let count = 1;
    if (name) { count++; query += `, name = $${count}`; values.push(name); }
    if (description) { count++; query += `, description = $${count}`; values.push(description); }
    if (binPath) { count++; query += `, path = $${count}`; values.push(binPath); }
    if (llm_model !== undefined) { count++; query += `, llm_model = $${count}`; values.push(llm_model); }
    if (temperature !== undefined) { count++; query += `, temperature = $${count}`; values.push(temperature); }
    if (max_tokens !== undefined) { count++; query += `, max_tokens = $${count}`; values.push(max_tokens); }
    
    count++; query += ` WHERE id = $${count} RETURNING *`;
    values.push(req.params.id);

    const { rows } = await pool.query(query, values);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/agents', async (req, res) => {
  const { name, description, path: binPath, config_uri, llm_model, temperature, max_tokens } = req.body;
  try {
    const { rows } = await pool.query(
      'INSERT INTO cli_agents (name, description, path, config_uri, installed, llm_model, temperature, max_tokens) VALUES ($1, $2, $3, $4, true, $5, $6, $7) RETURNING *',
      [name, description, binPath, config_uri, llm_model || 'gpt-4o', temperature || 0.7, max_tokens || 4096]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/agents/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM cli_agents WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save Project
app.post('/api/projects', async (req, res) => {
  const { name, desc, path: p, branch, tech, complete, tasks } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO projects (name, "desc", path, branch, tech, complete, tasks) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [name, desc, p, branch || 'main', tech || 'Unknown', complete || 0, JSON.stringify(tasks || [])]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Project
app.put('/api/projects/:id', async (req, res) => {
  const { tech, tasks, complete, branch } = req.body;
  
  let query = 'UPDATE projects SET tech = $1, tasks = $2, complete = $3';
  let values = [tech, JSON.stringify(tasks), complete];
  
  if (branch !== undefined) {
    query += ', branch = $4 WHERE id = $5 RETURNING *';
    values.push(branch, req.params.id);
  } else {
    query += ' WHERE id = $4 RETURNING *';
    values.push(req.params.id);
  }
  
  try {
    const { rows } = await pool.query(query, values);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Init Git
app.post('/api/init-git', (req, res) => {
  let { directory } = req.body;
  if (!directory) return res.status(400).json({ error: 'Missing directory' });
  
  if (directory.startsWith('~/')) {
    const home = process.env.HOME || process.env.USERPROFILE;
    directory = path.join(home, directory.slice(2));
  }
  
  exec(`git -C "${directory}" init && git -C "${directory}" branch -m main`, (error) => {
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, branch: 'main' });
  });
});

app.post('/api/deploy', (req, res) => {
  const { agent, directory, llmUrl, apiKey, tasks, useBrowserTerminal, remoteServer, remotePrompt } = req.body;
  let targetDir = directory || process.cwd();
  
  if (targetDir.startsWith('~/')) {
    const home = process.env.HOME || process.env.USERPROFILE;
    targetDir = path.join(home, targetDir.slice(2));
  }

  console.log(`Deploying ${agent} in ${targetDir}`);

  try {
    let command = '';
    let args = [];
    let env = { ...process.env };

    if (llmUrl) {
      env.ANTHROPIC_BASE_URL = llmUrl;
    }
    
    if (apiKey) {
      env.ANTHROPIC_API_KEY = apiKey;
      env.OPENAI_API_KEY = apiKey;
    }

    if (tasks && tasks.length > 0) {
      const list = tasks.map(t => {
        const prefix = t.status === 'completed' ? '[REWORK] ' : '';
        return `- [ ] ${prefix}${t.title}`;
      }).join('\n');
      const promptFile = path.join(targetDir, '.ai_tasks.md');
      fs.writeFileSync(promptFile, `# Zadania do wykonania\n\n${list}\n`);
    }

    if (agent === 'claude' || agent === 'agy') {
      if (agent === 'claude' && !env.ANTHROPIC_BASE_URL) {
        env.ANTHROPIC_BASE_URL = 'https://api.anthropic.com';
      }
      
      let agentCmd = '';
      const scriptPath = path.join(targetDir, '.start_agent.sh');
      if (remoteServer) {
        const sshCmd = `ssh -o StrictHostKeyChecking=accept-new -o BatchMode=yes ${remoteServer.username}@${remoteServer.host} -p ${remoteServer.port || 22}`;
        const promptText = `Jesteś DevOps agentem. Połącz się z serwerem przez SSH używając komendy: '${sshCmd}'. Następnie wykonaj zadanie: ${remotePrompt || 'Sprawdź stan serwera i zoptymalizuj go.'}. Wszystkie operacje wykonuj w ramach sesji SSH na zdalnym serwerze. UWAGA: używaj poleceń w pełni zautomatyzowanych, bez interaktywnych promptów (użyliśmy BatchMode=yes).`;
        agentCmd = agent === 'claude' ? `claude "${promptText}"` : `agy -i "${promptText}"`;
      } else {
        const promptArg = (tasks && tasks.length > 0) ? ' "Zrealizuj zadania z pliku .ai_tasks.md. Kiedy skończysz, oznacz je jako wykonane."' : '';
        agentCmd = agent === 'claude' ? `claude${promptArg}` : `agy${tasks && tasks.length > 0 ? ' -i' + promptArg : ''}`;
      }
      
      const scriptContent = `#!/bin/bash
cd "${targetDir}"
echo -e "\\033[1;34m🚀 Initializing AI Agent (${agent})...\\033[0m"
echo -ne "\\033[1;36m📡 Preparing environment: \\033[0m"
for i in {1..20}; do
    echo -ne "█"
    sleep 0.1
done
echo -e " \\033[1;32m[DONE]\\033[0m"

echo -ne "\\033[1;33m🔑 Authenticating with Gemini 3.1 Pro... \\033[0m"
for i in {1..10}; do
    echo -ne "."
    sleep 0.15
done
echo -e " \\033[1;32m[SUCCESS]\\033[0m"

echo -e "\\033[1;35m⏳ Booting agent engine. Please wait, this might take up to 15 seconds...\\033[0m"
${agentCmd}
exec bash
`;
      fs.writeFileSync(scriptPath, scriptContent);
      fs.chmodSync(scriptPath, '755');
      
      if (useBrowserTerminal) {
        // Return config for the frontend to connect via WebSockets
        return res.json({ 
          success: true, 
          browserTerminal: true, 
          command: 'bash', 
          args: [scriptPath], 
          cwd: targetDir, 
          env 
        });
      }

      command = 'x-terminal-emulator';
      args = ['-e', scriptPath];
    } else {
      return res.status(400).json({ error: 'Unknown agent' });
    }

    const child = spawn(command, args, {
      env,
      detached: true,
      stdio: 'ignore'
    });

    child.unref();
    res.json({ success: true, message: `${agent} launched in ${targetDir}` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/pick-folder', (req, res) => {
  exec('zenity --file-selection --directory --title="Wybierz folder projektu"', (error, stdout, stderr) => {
    if (error) {
      if (error.code === 1) return res.status(204).send();
      return res.status(500).json({ error: error.message });
    }
    res.json({ path: stdout.trim() });
  });
});

app.post('/api/analyze', async (req, res) => {
  let { directory } = req.body;
  if (!directory) return res.status(400).json({ error: 'Missing directory' });
  
  if (directory.startsWith('~/')) {
    const home = process.env.HOME || process.env.USERPROFILE;
    directory = path.join(home, directory.slice(2));
  }
  
  if (!fs.existsSync(directory)) {
    return res.status(400).json({ error: `Invalid directory: ${directory}` });
  }

  let techStack = 'Unknown';
  let tasks = [];
  
  try {
    const files = fs.readdirSync(directory);
    
    if (files.includes('package.json')) {
      const pkg = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
      if (pkg.dependencies?.next) techStack = 'Next.js (Node.js)';
      else if (pkg.dependencies?.react || pkg.devDependencies?.vite) techStack = 'React / Vite';
      else if (pkg.dependencies?.express) techStack = 'Node.js Express';
      else techStack = 'Node.js / JS';
    } else if (files.includes('pom.xml')) {
      techStack = 'Java Maven';
    } else if (files.includes('build.gradle')) {
      techStack = 'Java Gradle';
    } else if (files.includes('requirements.txt') || files.includes('pyproject.toml')) {
      techStack = 'Python';
    } else if (files.includes('Cargo.toml')) {
      techStack = 'Rust';
    } else if (files.includes('go.mod')) {
      techStack = 'Go';
    }

    let tasks = [];
    let idCounter = 1;

    // 1. Markdown checklists (*.md)
    const allFiles = fs.readdirSync(directory);
    const mdFiles = allFiles.filter(f => f.endsWith('.md') && !f.startsWith('node_modules'));
    for (const mdFile of mdFiles) {
      const mdPath = path.join(directory, mdFile);
      if (fs.existsSync(mdPath)) {
        const content = fs.readFileSync(mdPath, 'utf8');
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line.startsWith('- [ ]') || line.startsWith('* [ ]')) {
            let taskTitle = line.substring(5).trim();
            tasks.push({ id: idCounter++, title: taskTitle, meta: mdFile, status: 'pending' });
          } else if (line.startsWith('- [x]') || line.startsWith('* [x]')) {
             // Optional: read completed tasks too? Let's skip them for now or add them as completed
             let taskTitle = line.substring(5).trim();
             tasks.push({ id: idCounter++, title: taskTitle, meta: mdFile, status: 'completed' });
          }
        }
      }
    }

    // 2. Scan for TODO / FIXME in code
    try {
      const stdout = execSync(
        `grep -rnE --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist --exclude-dir=.autohand --exclude-dir=.gemini --exclude=SKILL.md "TOD[O]:|FIXM[E]:" "${directory}" | head -n 15`,
        { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }
      );
      const lines = stdout.split('\n').filter(Boolean);
      lines.forEach(line => {
        const match = line.match(/^([^:]+):(\d+):(.*)$/);
        if (match) {
           const file = path.basename(match[1]);
           let text = match[3].replace(/TOD[O]:/g, '').replace(/FIXM[E]:/g, '').trim();
           if (text.startsWith('//')) text = text.substring(2).trim();
           if (text.startsWith('*')) text = text.substring(1).trim();
           if (text.length > 60) text = text.substring(0, 57) + '...';
           if (text && !tasks.find(t => t.title === text)) {
             tasks.push({ id: idCounter++, title: text, meta: `Code: ${file}`, status: 'pending' });
           }
        }
      });
    } catch(e) {}

    // 3. Fallback to Package.json scripts only if no real tasks found
    if (tasks.length === 0 && fs.existsSync(path.join(directory, 'package.json'))) {
      const pkg = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
      if (pkg.scripts) {
        for (const scriptName of Object.keys(pkg.scripts)) {
          tasks.push({ id: idCounter++, title: `NPM Script: ${scriptName}`, meta: 'Scripts', status: 'pending' });
        }
      }
    }

    // 3. LLM Integration
    try {
      const { rows } = await pool.query("SELECT key, value FROM settings WHERE key IN ('llmUrl', 'apiKey')");
      let llmUrl, apiKey;
      rows.forEach(r => {
        if (r.key === 'llmUrl') llmUrl = r.value;
        if (r.key === 'apiKey') apiKey = decrypt(r.value);
      });

      if (llmUrl && apiKey) {
        const url = llmUrl.endsWith('/chat/completions') ? llmUrl : (llmUrl.endsWith('/') ? llmUrl.slice(0, -1) : llmUrl) + '/chat/completions';
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: 'lmstudio-community/Meta-Llama-3-8B-Instruct-GGUF', // Generic fallback
            messages: [{
              role: 'user', 
              content: `Zasugeruj 2 zadania (tablica JSON stringów np. ["Zrób A", "Zrób B"]) dla projektu w technologii: ${techStack}. Pomiń formatowanie i komentarze, wypisz samo JSON.`
            }],
            temperature: 0.3
          })
        });
        if (res.ok) {
          const llmData = await res.json();
          const content = llmData.choices[0].message.content;
          const jsonMatch = content.match(/\[.*\]/s);
          if (jsonMatch) {
            const aiTasks = JSON.parse(jsonMatch[0]);
            aiTasks.forEach(aiTask => {
              tasks.push({ id: idCounter++, title: aiTask, meta: 'AI Suggestion', status: 'pending' });
            });
          }
        }
      }
    } catch (e) {
      console.error("LLM error in analyze:", e);
    }

    if (tasks.length === 0) {
      tasks.push({ id: 1, title: 'Inicjalizacja środowiska', meta: 'Setup', status: 'pending' });
    }

    let branch = null;
    try {
      if (fs.existsSync(path.join(directory, '.git'))) {
        const stdout = execSync(`git -C "${directory}" branch --show-current`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
        branch = stdout.trim() || 'DETACHED';
      }
    } catch (e) {
      console.error('GIT BRANCH ERROR:', e.message, e.stderr);
    }

    res.json({ tech: techStack, tasks, branch });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// System Stats API
app.get('/api/system-stats', async (req, res) => {
  try {
    const { serverId } = req.query;

    if (serverId) {
      const serverRes = await pool.query('SELECT * FROM servers WHERE id = $1', [serverId]);
      if (serverRes.rows.length > 0) {
        const s = serverRes.rows[0];
        const nodeScript = `const os = require('os'); const totalMem = os.totalmem(); const freeMem = os.freemem(); console.log(JSON.stringify({ cpu: { cores: os.cpus().length, model: os.cpus()[0]?.model, load1: os.loadavg()[0], load5: os.loadavg()[1], load15: os.loadavg()[2] }, memory: { total: totalMem, free: freeMem, used: totalMem - freeMem, usagePercent: ((totalMem - freeMem) / totalMem) * 100 }, os: { platform: os.platform(), release: os.release(), uptime: os.uptime() } }));`;
        
        const cmd = sshCmd(s, `"node -e \\"${nodeScript}\\""`);
        
        exec(cmd, (error, stdout) => {
          if (error) {
            return res.status(500).json({ error: 'Failed to fetch remote stats: ' + error.message });
          }
          try {
            const stats = JSON.parse(stdout.trim());
            return res.json(stats);
          } catch (e) {
            return res.status(500).json({ error: 'Failed to parse remote stats' });
          }
        });
        return; // wait for exec callback
      }
    }

    // Local stats fallback
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memoryUsagePercent = (usedMem / totalMem) * 100;
    const cpuLoad = os.loadavg();
    
    res.json({
      cpu: {
        cores: os.cpus().length,
        model: os.cpus()[0]?.model,
        load1: cpuLoad[0],
        load5: cpuLoad[1],
        load15: cpuLoad[2]
      },
      memory: {
        total: totalMem,
        free: freeMem,
        used: usedMem,
        usagePercent: memoryUsagePercent
      },
      os: {
        platform: os.platform(),
        release: os.release(),
        uptime: os.uptime()
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// App Scanner API (Find running Node.js/web apps)
// On MyDevil.net (ct8.pl) hosting, Node.js apps run in isolated process jails
// and are NOT visible via `ps aux`. Use `devil www list` instead.
app.get('/api/apps-scan', async (req, res) => {
  try {
    const { serverId } = req.query;

    if (serverId) {
      const serverRes = await pool.query('SELECT * FROM servers WHERE id = $1', [serverId]);
      if (serverRes.rows.length > 0) {
        const s = serverRes.rows[0];
        const sshBase = sshCmd(s);

        if (s.use_devil) {
          // MyDevil.net hosting — Node.js apps run in process jails, invisible to ps aux
          // Use `devil www list` to enumerate all web apps
          exec(`${sshBase} "devil www list 2>/dev/null"`, (err, out) => {
            const apps = (!err && out)
              ? out.trim().split('\n')
                  .filter(line => /nodejs|python|ruby/.test(line))
                  .map(line => {
                    const parts = line.trim().split(/\s+/);
                    return {
                      user: s.username,
                      pid: '-', cpu: '-', mem: '-',
                      command: `${parts[1] || 'nodejs'}: ${parts[0] || ''}`,
                      domain: parts[0] || '',
                      type:   parts[1] || 'nodejs',
                      dir:    parts.slice(2).join(' ') || '',
                      source: 'devil'
                    };
                  })
              : [];
            res.json({ apps });
          });
        } else {
          // Standard Linux server — use ps aux
          exec(`${sshBase} "ps aux | grep node | grep -v grep"`, (err, out) => {
            const apps = (!err && out)
              ? out.trim().split('\n').filter(Boolean).map(line => {
                  const parts = line.split(/\s+/);
                  return {
                    user: parts[0], pid: parts[1], cpu: parts[2], mem: parts[3],
                    command: parts.slice(10).join(' '),
                    source: 'ps'
                  };
                })
              : [];
            res.json({ apps });
          });
        }
        return;
      }
    }

    // Local fallback (no serverId)
    exec('ps aux | grep node | grep -v grep', (error, stdout) => {
      let apps = [];
      if (!error && stdout) {
        apps = stdout.trim().split('\n').filter(Boolean).map(line => {
          const parts = line.split(/\s+/);
          return {
            user: parts[0],
            pid: parts[1],
            cpu: parts[2],
            mem: parts[3],
            command: parts.slice(10).join(' '),
            source: 'ps'
          };
        });
      }
      res.json({ apps });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Kill App API
app.post('/api/kill-app', async (req, res) => {
  try {
    const { serverId, pid, domain, source } = req.body;
    if (!serverId) return res.status(400).json({ error: 'Missing serverId' });
    
    const serverRes = await pool.query('SELECT * FROM servers WHERE id = $1', [serverId]);
    if (serverRes.rows.length === 0) return res.status(404).json({ error: 'Server not found' });
    const s = serverRes.rows[0];
    const sshBase = sshCmd(s);
    
    let killCmd = '';
    if (s.use_devil && source === 'devil') {
       if (!domain) return res.status(400).json({ error: 'Missing domain' });
       killCmd = `${sshBase} "devil www restart ${domain}"`;
    } else {
       if (!pid || pid === '-') return res.status(400).json({ error: 'Missing PID' });
       killCmd = `${sshBase} "kill -9 ${pid}"`;
    }

    exec(killCmd, (err, out) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, message: 'App killed/restarted' });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/analytics', async (req, res) => {
  try {
    const totalProjectsRes = await pool.query('SELECT COUNT(*) as count FROM projects');
    const totalProjects = parseInt(totalProjectsRes.rows[0].count, 10);
    
    const techStatsRes = await pool.query('SELECT tech, COUNT(*) as count FROM projects GROUP BY tech');
    const techStats = techStatsRes.rows.map(row => ({ tech: row.tech, count: parseInt(row.count, 10) }));
    
    const avgCompleteRes = await pool.query('SELECT AVG(complete) as avg FROM projects');
    const avgComplete = parseFloat(avgCompleteRes.rows[0].avg) || 0;
    
    res.json({
      totalProjects,
      techStats,
      avgComplete
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Custom Widgets API ---
app.get('/api/widgets', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM custom_widgets ORDER BY id ASC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/widgets', async (req, res) => {
  try {
    const { name, command, type, color, server_id } = req.body;
    const result = await pool.query(
      'INSERT INTO custom_widgets (name, command, type, color, server_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, command, type || 'number', color || '#c084fc', server_id || null]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/widgets/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM custom_widgets WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/widgets/:id/run', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM custom_widgets WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Widget not found' });
    const widget = rows[0];

    if (widget.server_id) {
      const serverRes = await pool.query('SELECT * FROM servers WHERE id = $1', [widget.server_id]);
      if (serverRes.rows.length > 0) {
        const s = serverRes.rows[0];
        // Use bash to execute the command correctly remotely, wrapping in quotes
        const cmd = sshCmd(s, `"bash -c '${widget.command.replace(/'/g, "'\\''")}'"`);
        exec(cmd, (error, stdout, stderr) => {
          if (error) {
            return res.status(500).json({ error: 'Remote execution failed: ' + (stderr || error.message) });
          }
          return res.json({ result: stdout.trim() });
        });
        return;
      }
    }

    // Local fallback
    exec(`bash -c "${widget.command.replace(/"/g, '\\"')}"`, (error, stdout, stderr) => {
      if (error) {
        return res.status(500).json({ error: 'Local execution failed: ' + (stderr || error.message) });
      }
      return res.json({ result: stdout.trim() });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


if (process.env.NODE_ENV !== 'test') {
  httpServer.listen(port, () => {
    console.log(`Backend API running on http://localhost:${port}`);
  });
}

export default app;

// Git Endpoints
app.post('/api/git/status', async (req, res) => {
  try {
    const { directory } = req.body;
    if (!fs.existsSync(path.join(directory, '.git'))) {
      return res.status(400).json({ error: 'Not a git repository' });
    }
    
    // Get branch
    const branch = execSync(`git -C "${directory}" branch --show-current`).toString().trim();
    
    // Get local changes
    const statusOut = execSync(`git -C "${directory}" status -s`).toString().trim();
    const changes = statusOut ? statusOut.split('\n') : [];
    
    // Get last 5 commits
    const logOut = execSync(`git -C "${directory}" log -n 5 --pretty=format:"%h|%s|%ar|%an"`).toString().trim();
    const commits = logOut ? logOut.split('\n').map(line => {
      const parts = line.split('|');
      return { hash: parts[0], msg: parts[1], time: parts[2], author: parts[3] };
    }) : [];
    
    res.json({ branch, changes, commits });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/git/github', async (req, res) => {
  try {
    const { directory } = req.body;
    if (!fs.existsSync(path.join(directory, '.git'))) {
      return res.status(400).json({ error: 'Not a git repository' });
    }
    
    const prsOut = execSync(`gh pr list --json title,number,url,state --limit 5`, { cwd: directory, stdio: ['pipe', 'pipe', 'pipe'] }).toString();
    const prs = JSON.parse(prsOut || '[]');
    
    const runsOut = execSync(`gh run list --limit 1 --json status,conclusion`, { cwd: directory, stdio: ['pipe', 'pipe', 'pipe'] }).toString();
    const runs = JSON.parse(runsOut || '[]');
    const latestRun = runs.length > 0 ? runs[0] : null;
    
    res.json({ prs, latestRun });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/git/cancel-ci', async (req, res) => {
  try {
    const { directory } = req.body;
    if (!fs.existsSync(path.join(directory, '.git'))) {
      return res.status(400).json({ error: 'Not a git repository' });
    }
    
    // Find running CI jobs
    const runsOut = execSync(`gh run list --status in_progress --json databaseId -q ".[].databaseId"`, { cwd: directory, stdio: ['pipe', 'pipe', 'pipe'] }).toString();
    const runIds = runsOut.trim().split('\\n').filter(Boolean);
    
    if (runIds.length === 0) {
      return res.json({ success: true, message: 'No running CI jobs found' });
    }
    
    for (const id of runIds) {
      execSync(`gh run cancel ${id}`, { cwd: directory });
    }
    
    res.json({ success: true, canceledCount: runIds.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/git/deploy', async (req, res) => {
  try {
    const { directory } = req.body;
    if (!fs.existsSync(path.join(directory, '.git'))) {
      return res.status(400).json({ error: 'Not a git repository' });
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

    let deployLog = "Pushed successfully.\\n";

    // 3. Execute deploy script if exists
    const deployScriptPath = path.join(directory, 'scripts', 'deploy-ct8-optimized.sh');
    if (fs.existsSync(deployScriptPath)) {
      deployLog += "Executing custom deploy script...\\n";
      const scriptOutput = execSync(`bash "${deployScriptPath}"`, { cwd: directory }).toString();
      deployLog += scriptOutput;
    } else {
      deployLog += "No custom deploy script found. Skipped remote execution.\\n";
    }

    res.json({ success: true, log: deployLog });
  } catch (e) {
    res.status(500).json({ error: e.message, stdout: e.stdout ? e.stdout.toString() : '' });
  }
});
