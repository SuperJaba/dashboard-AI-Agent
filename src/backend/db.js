import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();
const { Pool } = pkg;

const schema = process.env.DB_SCHEMA || 'dashboard';

export const pool = new Pool({
  user: process.env.DB_USER || process.env.PGUSER || 'SebaP',
  host: process.env.DB_HOST || process.env.PGHOST || 'localhost',
  database: process.env.DB_NAME || process.env.PGDATABASE || 'dashboarddb',
  password: process.env.DB_PASSWORD || process.env.PGPASSWORD,
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : (process.env.PGPORT ? parseInt(process.env.PGPORT) : 5432),
  connectionTimeoutMillis: 10000,
  options: `-c search_path=${schema},public`,
});

// Suppress unhandled connection error events from pg pool
if (pool && typeof pool.on === 'function') {
  pool.on('error', (err) => {
    console.warn('PostgreSQL Pool background connection warning:', err.message);
  });
}

// Fallback in-memory store when PostgreSQL is disconnected or unavailable
export const inMemoryStore = {
  users: [],
  settings: {
    llmName: 'AtomicChat',
    llmUrl: 'http://127.0.0.1:1337/v1',
    llmModel: 'AtomicChat/qwen35-4b-Q8_0',
  },
  projects: [],
  servers: [],
  cli_agents: [],
  custom_widgets: [],
  agents: [],
  user_settings: []
};

let useInMemoryFallback = false;

const rawPoolQuery = pool.query.bind(pool);

export async function safeQuery(text, params = []) {
  if (!useInMemoryFallback) {
    try {
      return await rawPoolQuery(text, params);
    } catch (err) {
      if (err.code === 'ECONNREFUSED' || err.code === '57P01' || err.message?.includes('connect ECONNREFUSED')) {
        console.warn('PostgreSQL connection unavailable, using fallback store:', err.message);
        useInMemoryFallback = true;
      } else {
        throw err;
      }
    }
  }

  const sql = text.trim();

  // Users queries
  if (sql.includes('FROM users') && sql.includes('COUNT')) {
    return { rows: [{ count: inMemoryStore.users.length.toString() }] };
  }

  if (sql.includes('FROM users WHERE username')) {
    const user = inMemoryStore.users.find(u => u.username === params[0]);
    return { rows: user ? [user] : [] };
  }

  if (sql.includes('INSERT INTO users')) {
    const newUser = { id: inMemoryStore.users.length + 1, username: params[0], password_hash: params[1] };
    inMemoryStore.users.push(newUser);
    return { rows: [newUser] };
  }

  if (sql.includes('DELETE FROM users')) {
    inMemoryStore.users = [];
    return { rows: [] };
  }

  // Settings queries
  if (sql.includes('FROM settings WHERE key')) {
    if (sql.includes('WHERE key IN')) {
      const keys = ['llmUrl', 'apiKey'];
      const rows = keys.filter(k => inMemoryStore.settings[k] !== undefined).map(k => ({ key: k, value: inMemoryStore.settings[k] }));
      return { rows };
    }
    const val = inMemoryStore.settings[params[0]];
    return { rows: val !== undefined ? [{ value: val }] : [] };
  }

  if (sql.includes('FROM settings')) {
    const rows = Object.entries(inMemoryStore.settings).map(([k, v]) => ({ key: k, value: v }));
    return { rows };
  }

  if (sql.includes('INSERT INTO settings') || sql.includes('UPDATE settings')) {
    if (params.length >= 2) {
      inMemoryStore.settings[params[0]] = params[1];
    }
    return { rows: [] };
  }

  // Projects queries
  if (sql.includes('FROM projects')) {
    if (sql.includes('WHERE id = $1')) {
      const p = inMemoryStore.projects.find(x => x.id === parseInt(params[0], 10));
      return { rows: p ? [p] : [] };
    }
    return { rows: inMemoryStore.projects };
  }

  if (sql.includes('INSERT INTO projects')) {
    const newProj = {
      id: inMemoryStore.projects.length + 1,
      name: params[0],
      desc: params[1],
      path: params[2],
      branch: params[3] || 'main',
      tech: params[4] || 'Unknown',
      complete: params[5] || 0,
      tasks: typeof params[6] === 'string' ? JSON.parse(params[6] || '[]') : (params[6] || [])
    };
    inMemoryStore.projects.push(newProj);
    return { rows: [newProj] };
  }

  if (sql.includes('UPDATE projects')) {
    const id = params[params.length - 1];
    const p = inMemoryStore.projects.find(x => x.id === parseInt(id, 10));
    return { rows: p ? [p] : [] };
  }

  if (sql.includes('DELETE FROM projects')) {
    const id = parseInt(params[0], 10);
    inMemoryStore.projects = inMemoryStore.projects.filter(p => p.id !== id);
    return { rows: [] };
  }

  // Servers queries
  if (sql.includes('FROM servers')) {
    if (sql.includes('WHERE id = $1')) {
      const s = inMemoryStore.servers.find(x => x.id === parseInt(params[0], 10));
      return { rows: s ? [s] : [] };
    }
    return { rows: inMemoryStore.servers };
  }

  // Agents queries
  if (sql.includes('FROM cli_agents')) {
    if (sql.includes('WHERE id = $1')) {
      const a = inMemoryStore.cli_agents.find(x => x.id === parseInt(params[0], 10));
      return { rows: a ? [a] : [] };
    }
    if (sql.includes('WHERE name = $1')) {
      const a = inMemoryStore.cli_agents.find(x => x.name.toLowerCase() === String(params[0]).toLowerCase());
      return { rows: a ? [a] : [] };
    }
    return { rows: inMemoryStore.cli_agents };
  }

  if (sql.includes('INSERT INTO cli_agents')) {
    const newAgent = {
      id: inMemoryStore.cli_agents.length + 1,
      name: params[0],
      description: params[1],
      path: params[2],
      config_uri: params[3],
      installed: params[4] !== undefined ? params[4] : true,
      llm_model: params[5] || 'gpt-4o',
      temperature: params[6] !== undefined ? params[6] : 0.7,
      max_tokens: params[7] !== undefined ? params[7] : 4096
    };
    const existingIdx = inMemoryStore.cli_agents.findIndex(x => x.name.toLowerCase() === newAgent.name.toLowerCase());
    if (existingIdx >= 0) {
      inMemoryStore.cli_agents[existingIdx] = { ...inMemoryStore.cli_agents[existingIdx], ...newAgent, id: inMemoryStore.cli_agents[existingIdx].id };
      return { rows: [inMemoryStore.cli_agents[existingIdx]] };
    }
    inMemoryStore.cli_agents.push(newAgent);
    return { rows: [newAgent] };
  }

  if (sql.includes('UPDATE cli_agents')) {
    if (sql.includes('SET path = $1')) {
      const [pathVal, configUri, name] = params;
      const a = inMemoryStore.cli_agents.find(x => x.name.toLowerCase() === String(name).toLowerCase());
      if (a) {
        a.path = pathVal;
        if (configUri) a.config_uri = configUri;
        a.installed = true;
        return { rows: [a] };
      }
    } else if (sql.includes('SET installed = $1')) {
      const [installed, id] = params;
      const a = inMemoryStore.cli_agents.find(x => x.id === parseInt(id, 10));
      if (a) {
        a.installed = installed;
        return { rows: [a] };
      }
    }
    return { rows: [] };
  }

  if (sql.includes('FROM agents')) {
    return { rows: inMemoryStore.agents };
  }

  // Custom widgets
  if (sql.includes('FROM custom_widgets')) {
    if (sql.includes('WHERE id')) {
      const id = String(params[0]);
      const widget = inMemoryStore.custom_widgets.find(w => String(w.id) === id);
      return { rows: widget ? [widget] : [] };
    }
    return { rows: [...inMemoryStore.custom_widgets] };
  }

  if (sql.includes('INSERT INTO custom_widgets')) {
    const [name, command, type, color, server_id] = params;
    const nextId = inMemoryStore.custom_widgets.length > 0
      ? Math.max(...inMemoryStore.custom_widgets.map(w => Number(w.id) || 0)) + 1
      : 1;
    const newWidget = {
      id: nextId,
      name,
      command,
      type: type || 'number',
      color: color || '#c084fc',
      server_id: server_id || null,
      created_at: new Date().toISOString(),
    };
    inMemoryStore.custom_widgets.push(newWidget);
    return { rows: [newWidget] };
  }

  if (sql.includes('UPDATE custom_widgets')) {
    const id = String(params[params.length - 1]);
    const [name, command, type, color, server_id] = params;
    const widget = inMemoryStore.custom_widgets.find(w => String(w.id) === id);
    if (widget) {
      if (name !== undefined && name !== null) widget.name = name;
      if (command !== undefined && command !== null) widget.command = command;
      if (type !== undefined && type !== null) widget.type = type;
      if (color !== undefined && color !== null) widget.color = color;
      if (server_id !== undefined) widget.server_id = server_id || null;
      return { rows: [{ ...widget }] };
    }
    return { rows: [] };
  }

  if (sql.includes('DELETE FROM custom_widgets')) {
    const id = String(params[0]);
    inMemoryStore.custom_widgets = inMemoryStore.custom_widgets.filter(w => String(w.id) !== id);
    return { rows: [] };
  }

  // User settings (theme/language per user)
  if (sql.includes('FROM user_settings')) {
    const row = inMemoryStore.user_settings.find(r => r.user_id === params[0]);
    return { rows: row ? [row] : [] };
  }

  if (sql.includes('INSERT INTO user_settings')) {
    const [userId, theme, language] = params;
    let row = inMemoryStore.user_settings.find(r => r.user_id === userId);
    if (row) {
      if (theme !== null && theme !== undefined) {row.theme = theme;}
      if (language !== null && language !== undefined) {row.language = language;}
    } else {
      row = { user_id: userId, theme: theme || 'dark', language: language || 'pl' };
      inMemoryStore.user_settings.push(row);
    }
    return { rows: [row] };
  }

  return { rows: [] };
}

// Redirect pool.query through safeQuery so all repositories gracefully use in-memory fallback if PG is down
pool.query = async function(text, params = []) {
  return safeQuery(text, params);
};

// ---------- Database Migration ----------
export async function migrate() {
  const queries = [
    `CREATE TABLE IF NOT EXISTS settings (
      key VARCHAR(255) PRIMARY KEY,
      value TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS servers (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      host VARCHAR(255),
      username VARCHAR(255),
      port INTEGER DEFAULT 22,
      provider VARCHAR(255) DEFAULT 'local',
      url VARCHAR(512),
      model VARCHAR(255),
      api_key TEXT,
      use_devil BOOLEAN DEFAULT false,
      ssh_password TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS llm_servers (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      url VARCHAR(512) NOT NULL,
      api_key TEXT,
      model VARCHAR(255),
      provider VARCHAR(255) DEFAULT 'Custom',
      is_active BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS projects (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      "desc" TEXT,
      path TEXT NOT NULL,
      branch VARCHAR(255) DEFAULT 'main',
      tech VARCHAR(255) DEFAULT 'Unknown',
      complete INTEGER DEFAULT 0,
      tasks JSONB DEFAULT '[]'::jsonb
    );`,
    `CREATE TABLE IF NOT EXISTS cli_agents (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      description TEXT,
      path VARCHAR(255),
      config_uri TEXT,
      installed BOOLEAN DEFAULT false,
      llm_model VARCHAR(255),
      temperature NUMERIC DEFAULT 0.7,
      max_tokens INTEGER DEFAULT 4096
    );`,
    `CREATE TABLE IF NOT EXISTS custom_widgets (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      command TEXT NOT NULL,
      type VARCHAR(50) DEFAULT 'number',
      color VARCHAR(50) DEFAULT '#c084fc',
      server_id INTEGER
    );`,
    `CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(255) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS agents (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      description TEXT,
      server_id INTEGER REFERENCES servers(id),
      status VARCHAR(50) DEFAULT 'stopped',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`,
    'ALTER TABLE servers ADD COLUMN IF NOT EXISTS host VARCHAR(255);',
    'ALTER TABLE servers ADD COLUMN IF NOT EXISTS username VARCHAR(255);',
    'ALTER TABLE servers ADD COLUMN IF NOT EXISTS port INTEGER DEFAULT 22;',
    'ALTER TABLE servers ADD COLUMN IF NOT EXISTS provider VARCHAR(255) DEFAULT \'local\';',
    'ALTER TABLE servers ADD COLUMN IF NOT EXISTS url VARCHAR(512);',
    'ALTER TABLE servers ADD COLUMN IF NOT EXISTS model VARCHAR(255);',
    'ALTER TABLE servers ADD COLUMN IF NOT EXISTS api_key TEXT;',
    'ALTER TABLE servers ADD COLUMN IF NOT EXISTS use_devil BOOLEAN DEFAULT false;',
    'ALTER TABLE servers ADD COLUMN IF NOT EXISTS ssh_password TEXT;',
    `CREATE TABLE IF NOT EXISTS user_settings (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      theme VARCHAR(20) DEFAULT 'dark',
      language VARCHAR(10) DEFAULT 'pl',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`
  ];

  for (const q of queries) {
    await safeQuery(q);
  }

  // Default settings seeding
  await safeQuery("INSERT INTO settings (key, value) VALUES ('llmName', 'AtomicChat') ON CONFLICT (key) DO NOTHING;");
  await safeQuery("INSERT INTO settings (key, value) VALUES ('llmUrl', 'http://127.0.0.1:1337/v1') ON CONFLICT (key) DO NOTHING;");
  await safeQuery("INSERT INTO settings (key, value) VALUES ('llmModel', 'AtomicChat/qwen35-4b-Q8_0') ON CONFLICT (key) DO NOTHING;");
}

// Run migrations automatically when the module is loaded.
(async () => {
  try {
    await migrate();
  } catch (e) {
    console.warn('Database migration error:', e.message);
  }
})();
