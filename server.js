import express from 'express';
import cors from 'cors';
import { spawn, exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import pkg from 'pg';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pkg;
const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

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
  const { llmUrl, apiKey } = req.body;
  try {
    if (llmUrl !== undefined) {
      await pool.query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', ['llmUrl', llmUrl]);
    }
    if (apiKey !== undefined) {
      await pool.query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', ['apiKey', encrypt(apiKey)]);
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
  const { tech, tasks, complete } = req.body;
  try {
    const { rows } = await pool.query(
      'UPDATE projects SET tech = $1, tasks = $2, complete = $3 WHERE id = $4 RETURNING *',
      [tech, JSON.stringify(tasks), complete, req.params.id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/deploy', (req, res) => {
  const { agent, directory, llmUrl, apiKey } = req.body;
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

    if (agent === 'claude') {
      if (!env.ANTHROPIC_BASE_URL) env.ANTHROPIC_BASE_URL = 'https://api.anthropic.com';
      command = 'x-terminal-emulator';
      args = ['-e', `bash -c "cd ${targetDir} && claude; exec bash"`];
    } else if (agent === 'agy') {
      command = 'x-terminal-emulator';
      args = ['-e', `bash -c "cd ${targetDir} && agy; exec bash"`];
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

app.post('/api/analyze', (req, res) => {
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

    if (techStack !== 'Unknown') {
      tasks.push({ id: 1, title: 'Analiza zależności projektu', meta: 'Discovery', status: 'completed' });
      tasks.push({ id: 2, title: 'Uruchomienie serwera dev', meta: 'Setup', status: 'pending' });
      tasks.push({ id: 3, title: 'Wdrożenie zmian', meta: 'DevOps', status: 'pending' });
    }

    res.json({ tech: techStack, tasks });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Backend API running on http://localhost:${port}`);
});
