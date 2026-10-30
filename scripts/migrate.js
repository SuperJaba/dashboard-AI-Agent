import pkg from 'pg';
import dotenv from 'dotenv';
import { safeQuery } from '../src/backend/db.js';

dotenv.config();
const { Client } = pkg;

export async function ensureDatabaseExists() {
  const dbName = process.env.DB_NAME || process.env.PGDATABASE || 'dashboarddb';
  const user = process.env.DB_USER || process.env.PGUSER || 'SebaP';
  const host = process.env.DB_HOST || process.env.PGHOST || 'localhost';
  const password = process.env.DB_PASSWORD || process.env.PGPASSWORD;
  const port = process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : (process.env.PGPORT ? parseInt(process.env.PGPORT, 10) : 5432);

  const candidateAdminDbs = [process.env.DB_ADMIN_NAME, 'postgres', 'template1', user].filter(Boolean);
  let checked = false;

  for (const adminDb of candidateAdminDbs) {
    let client;
    try {
      client = new Client({
        user,
        host,
        database: adminDb,
        password,
        port,
        connectionTimeoutMillis: 5000,
      });

      await client.connect();
      console.log(`🔍 Checking if database '${dbName}' exists (via '${adminDb}')...`);
      const res = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
      if (res.rowCount === 0) {
        console.log(`📦 Database '${dbName}' does not exist. Creating...`);
        const safeDbName = dbName.replace(/"/g, '""');
        await client.query(`CREATE DATABASE "${safeDbName}";`);
        console.log(`✅ Database '${dbName}' created successfully.`);
      } else {
        console.log(`✓ Database '${dbName}' already exists.`);
      }
      checked = true;
      break;
    } catch (err) {
      if (err.code === 'ECONNREFUSED' || err.message?.includes('ECONNREFUSED')) {
        console.warn('⚠️ PostgreSQL server is not reachable, skipping database creation (will use fallback store if needed).');
        return;
      }
      // Try next admin candidate database
    } finally {
      if (client) {
        await client.end().catch(() => {});
      }
    }
  }

  if (!checked) {
    console.warn(`ℹ️ Note: Could not verify database existence via admin DBs. Proceeding with migration...`);
  }
}

export async function runMigrations() {
  await ensureDatabaseExists();

  const schema = process.env.DB_SCHEMA || 'dashboard';
  console.log(`🔄 Running database migrations in schema '${schema}'...`);
  try {
    await safeQuery(`CREATE SCHEMA IF NOT EXISTS ${schema};`);
    await safeQuery(`SET search_path TO ${schema}, public;`);

    // Create tables safely if they do not exist
    console.log('📝 Creating database tables if not exist...');
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
        installed BOOLEAN DEFAULT false,
        llm_model VARCHAR(255),
        temperature NUMERIC DEFAULT 0.7,
        max_tokens INTEGER DEFAULT 4096
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
      CREATE TABLE IF NOT EXISTS agent_scheduled_tasks (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        task_type VARCHAR(100) NOT NULL,
        command TEXT,
        cron_expression VARCHAR(100) NOT NULL,
        enabled BOOLEAN DEFAULT true,
        last_run TIMESTAMP,
        last_status VARCHAR(50) DEFAULT 'idle',
        last_output TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Ensure alter columns exist for upgrades
    await safeQuery('ALTER TABLE servers ADD COLUMN IF NOT EXISTS use_devil BOOLEAN DEFAULT false;');
    await safeQuery('ALTER TABLE servers ADD COLUMN IF NOT EXISTS ssh_password TEXT;');
    await safeQuery('ALTER TABLE servers ADD COLUMN IF NOT EXISTS provider VARCHAR(255) DEFAULT \'local\';');
    await safeQuery('ALTER TABLE servers ADD COLUMN IF NOT EXISTS url VARCHAR(512);');
    await safeQuery('ALTER TABLE servers ADD COLUMN IF NOT EXISTS model VARCHAR(255);');
    await safeQuery('ALTER TABLE servers ADD COLUMN IF NOT EXISTS api_key TEXT;');
    await safeQuery('ALTER TABLE cli_agents ADD COLUMN IF NOT EXISTS llm_model VARCHAR(255);');
    await safeQuery('ALTER TABLE cli_agents ADD COLUMN IF NOT EXISTS temperature NUMERIC DEFAULT 0.7;');
    await safeQuery('ALTER TABLE cli_agents ADD COLUMN IF NOT EXISTS max_tokens INTEGER DEFAULT 4096;');

    // Default settings seeding
    console.log('📝 Seeding default settings...');
    await safeQuery("INSERT INTO settings (key, value) VALUES ('llmName', 'AtomicChat') ON CONFLICT (key) DO NOTHING;");
    await safeQuery("INSERT INTO settings (key, value) VALUES ('llmUrl', 'http://127.0.0.1:1337/v1') ON CONFLICT (key) DO NOTHING;");
    await safeQuery("INSERT INTO settings (key, value) VALUES ('llmModel', 'AtomicChat/qwen35-4b-Q8_0') ON CONFLICT (key) DO NOTHING;");
    
    console.log('✅ Database migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

runMigrations();
