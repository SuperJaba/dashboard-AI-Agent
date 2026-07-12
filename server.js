import express from 'express';
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

dotenv.config();

const { Pool } = pkg;
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

// API Auth Middleware
const authMiddleware = (req, res, next) => {
  // Allow OPTIONS requests for CORS
  if (req.method === 'OPTIONS') return next();
  
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = authHeader.split(' ')[1];
  if (token !== (process.env.API_TOKEN || 'dashboard-secret-token')) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
};

app.use('/api', authMiddleware);

// DB Connection
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

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
  const { agent, directory, llmUrl, apiKey, tasks, useBrowserTerminal } = req.body;
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
      const scriptPath = path.join(targetDir, '.start_agent.sh');
      const promptArg = (tasks && tasks.length > 0) ? ' "Zrealizuj zadania z pliku .ai_tasks.md. Kiedy skończysz, oznacz je jako wykonane."' : '';
      const agentCmd = agent === 'claude' ? `claude${promptArg}` : `agy${tasks && tasks.length > 0 ? ' -i' + promptArg : ''}`;
      
      const scriptContent = `#!/bin/bash\ncd "${targetDir}"\n${agentCmd}\nexec bash\n`;
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

    // 1. Markdown checklists (tasks.md, TODO.md, README.md)
    const mdFiles = ['tasks.md', 'TODO.md', 'README.md'];
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

if (process.env.NODE_ENV !== 'test') {
  httpServer.listen(port, () => {
    console.log(`Backend API running on http://localhost:${port}`);
  });
}

export default app;
