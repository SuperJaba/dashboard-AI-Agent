import { pool } from '../src/backend/db.js';

async function runMigrations() {
  const schema = process.env.DB_SCHEMA || 'dashboard';
  console.log(`🔄 Running database migrations in schema '${schema}'...`);
  const client = await pool.connect();
  try {
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${schema};`);
    await client.query(`SET search_path TO ${schema}, public;`);

    // Drop tables if they exist (to fix corruption)
    console.log(`📊 Dropping existing tables in schema '${schema}' to ensure clean state...`);
    await client.query(`
      DROP TABLE IF EXISTS ${schema}.settings CASCADE;
      DROP TABLE IF EXISTS ${schema}.projects CASCADE;
      DROP TABLE IF EXISTS ${schema}.servers CASCADE;
      DROP TABLE IF EXISTS ${schema}.cli_agents CASCADE;
      DROP TABLE IF EXISTS ${schema}.custom_widgets CASCADE;
      DROP TABLE IF EXISTS ${schema}.llm_servers CASCADE;
      DROP TABLE IF EXISTS ${schema}.users CASCADE;
      DROP TABLE IF EXISTS ${schema}.user_settings CASCADE;
      DROP TABLE IF EXISTS ${schema}.agents CASCADE;
    `);
    
    // Create tables with correct structure
    console.log('📝 Creating database tables...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${schema}.settings (
        id SERIAL PRIMARY KEY,
        key VARCHAR(255) UNIQUE NOT NULL,
        value TEXT NOT NULL
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS ${schema}.projects (
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

    await client.query(`
      CREATE TABLE IF NOT EXISTS ${schema}.servers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        host VARCHAR(255) NOT NULL,
        username VARCHAR(255) NOT NULL,
        port INTEGER DEFAULT 22,
        use_devil BOOLEAN DEFAULT false,
        ssh_password TEXT
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS ${schema}.cli_agents (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        description TEXT,
        path VARCHAR(255),
        config_uri TEXT,
        installed BOOLEAN DEFAULT false,
        llm_model VARCHAR(255),
        temperature NUMERIC DEFAULT 0.7,
        max_tokens INTEGER DEFAULT 4096
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS ${schema}.custom_widgets (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        command TEXT NOT NULL,
        type VARCHAR(50) DEFAULT 'number',
        color VARCHAR(50) DEFAULT '#c084fc',
        server_id INTEGER
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS ${schema}.llm_servers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        url VARCHAR(512) NOT NULL,
        api_key TEXT,
        model VARCHAR(255),
        provider VARCHAR(255) DEFAULT 'Custom',
        is_active BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS ${schema}.users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS ${schema}.user_settings (
        user_id INTEGER PRIMARY KEY REFERENCES ${schema}.users(id) ON DELETE CASCADE,
        theme VARCHAR(20) DEFAULT 'dark',
        language VARCHAR(10) DEFAULT 'pl',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    // Create additional tables if missing
    console.log('📝 Creating additional tables...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${schema}.agents (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        description TEXT,
        server_id INTEGER REFERENCES ${schema}.servers(id),
        status VARCHAR(50) DEFAULT 'stopped',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Ensure alter columns exist for upgrades
    await client.query(`ALTER TABLE ${schema}.servers ADD COLUMN IF NOT EXISTS use_devil BOOLEAN DEFAULT false;`);
    await client.query(`ALTER TABLE ${schema}.servers ADD COLUMN IF NOT EXISTS ssh_password TEXT;`);
    await client.query(`ALTER TABLE ${schema}.servers ADD COLUMN IF NOT EXISTS provider VARCHAR(255) DEFAULT 'local';`);
    await client.query(`ALTER TABLE ${schema}.servers ADD COLUMN IF NOT EXISTS url VARCHAR(512);`);
    await client.query(`ALTER TABLE ${schema}.servers ADD COLUMN IF NOT EXISTS model VARCHAR(255);`);
    await client.query(`ALTER TABLE ${schema}.servers ADD COLUMN IF NOT EXISTS api_key TEXT;`);
    await client.query(`ALTER TABLE ${schema}.cli_agents ADD COLUMN IF NOT EXISTS llm_model VARCHAR(255);`);
    await client.query(`ALTER TABLE ${schema}.cli_agents ADD COLUMN IF NOT EXISTS temperature NUMERIC DEFAULT 0.7;`);
    await client.query(`ALTER TABLE ${schema}.cli_agents ADD COLUMN IF NOT EXISTS max_tokens INTEGER DEFAULT 4096;`);

    // Default settings seeding
    console.log('📝 Seeding default settings...');
    await client.query(`INSERT INTO ${schema}.settings (key, value) VALUES ('llmName', 'AtomicChat') ON CONFLICT (key) DO NOTHING;`);
    await client.query(`INSERT INTO ${schema}.settings (key, value) VALUES ('llmUrl', 'http://127.0.0.1:1337/v1') ON CONFLICT (key) DO NOTHING;`);
    await client.query(`INSERT INTO ${schema}.settings (key, value) VALUES ('llmModel', 'AtomicChat/qwen35-4b-Q8_0') ON CONFLICT (key) DO NOTHING;`);
    
    console.log('✅ Database migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    if (client) client.release();
  }
}

runMigrations();
