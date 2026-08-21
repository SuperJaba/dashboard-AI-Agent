import { safeQuery } from '../src/backend/db.js';

async function runMigrations() {
  console.log('🔄 Running database migrations...');
  try {
    await safeQuery(`
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
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL
      );
    `);

    // Ensure alter columns exist for upgrades
    await safeQuery('ALTER TABLE servers ADD COLUMN IF NOT EXISTS use_devil BOOLEAN DEFAULT false;');
    await safeQuery('ALTER TABLE servers ADD COLUMN IF NOT EXISTS ssh_password TEXT;');
    await safeQuery('ALTER TABLE cli_agents ADD COLUMN IF NOT EXISTS llm_model VARCHAR(255);');
    await safeQuery('ALTER TABLE cli_agents ADD COLUMN IF NOT EXISTS temperature NUMERIC DEFAULT 0.7;');
    await safeQuery('ALTER TABLE cli_agents ADD COLUMN IF NOT EXISTS max_tokens INTEGER DEFAULT 4096;');

    // Default settings seeding
    await safeQuery('INSERT INTO settings (key, value) VALUES (\'llmName\', \'AtomicChat\') ON CONFLICT (key) DO NOTHING;');
    await safeQuery('INSERT INTO settings (key, value) VALUES (\'llmUrl\', \'http://127.0.0.1:1337/v1\') ON CONFLICT (key) DO NOTHING;');
    await safeQuery('INSERT INTO settings (key, value) VALUES (\'llmModel\', \'AtomicChat/qwen35-4b-Q8_0\') ON CONFLICT (key) DO NOTHING;');

    console.log('✅ Database migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
}

runMigrations();
