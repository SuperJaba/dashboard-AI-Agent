import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();
const { Pool } = pkg;

export const pool = new Pool({
  user: process.env.DB_USER || process.env.PGUSER || 'postgres',
  host: process.env.DB_HOST || process.env.PGHOST || '127.0.0.1',
  database: process.env.DB_NAME || process.env.PGDATABASE || 'dashboard',
  password: process.env.DB_PASSWORD || process.env.PGPASSWORD || 'postgres',
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : (process.env.PGPORT ? parseInt(process.env.PGPORT) : 5432),
  connectionTimeoutMillis: 2000,
});

// Suppress unhandled connection error events from pg pool
if (pool && typeof pool.on === 'function') {
  pool.on('error', (err) => {
    console.warn('PostgreSQL Pool background connection warning:', err.message);
  });
}

// Fallback in-memory store when PostgreSQL is disconnected or unavailable
const inMemoryStore = {
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
  user_settings: []
};

let useInMemoryFallback = false;

export async function safeQuery(text, params = []) {
  if (!useInMemoryFallback) {
    try {
      return await pool.query(text, params);
    } catch (err) {
      console.warn('PostgreSQL query unavailable, using fallback store:', err.message);
      useInMemoryFallback = true;
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
    const val = inMemoryStore.settings[params[0]];
    return { rows: val !== undefined ? [{ value: val }] : [] };
  }

  if (sql.includes('INSERT INTO settings') || sql.includes('UPDATE settings')) {
    if (params.length >= 2) {
      inMemoryStore.settings[params[0]] = params[1];
    }
    return { rows: [] };
  }

  // Projects queries
  if (sql.includes('FROM projects')) {
    return { rows: inMemoryStore.projects };
  }

  // Servers queries
  if (sql.includes('FROM servers')) {
    return { rows: inMemoryStore.servers };
  }

  // Agents queries
  if (sql.includes('FROM cli_agents')) {
    return { rows: inMemoryStore.cli_agents };
  }

  // Custom widgets
  if (sql.includes('FROM custom_widgets')) {
    return { rows: inMemoryStore.custom_widgets };
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

// ---------- Database Migration ----------
// Ensure the 'servers' table exists for storing LLM server configurations.
export async function migrate() {
  const queries = [
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
}

// Run migrations automatically when the module is loaded.
(async () => {
  try {
    await migrate();
  } catch (e) {
    console.warn('Database migration error:', e.message);
  }
})();
