import { safeQuery } from '../src/backend/db.js';

async function runMigrations() {
  console.log('🔄 Running database migrations...');
  try {
    // Drop tables if they exist (to fix corruption)
    console.log('📊 Dropping existing tables to ensure clean state...');
    await safeQuery(`
      DROP TABLE IF EXISTS settings CASCADE;
      DROP TABLE IF EXISTS projects CASCADE;
      DROP TABLE IF EXISTS servers CASCADE;
      DROP TABLE IF EXISTS cli_agents CASCADE;
      DROP TABLE IF EXISTS custom_widgets CASCADE;
      DROP TABLE IF EXISTS llm_servers CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
    `);
    
    // Create tables with correct structure
    console.log('📝 Creating database tables...');
    await safeQuery(`
      CREATE TABLE settings (
        id SERIAL PRIMARY KEY,
        key VARCHAR(255) UNIQUE NOT NULL,
        value TEXT NOT NULL
      );
      
      CREATE TABLE projects (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        "desc" TEXT,
        path TEXT NOT NULL,
        branch VARCHAR(255) DEFAULT 'main',
        tech VARCHAR(255) DEFAULT 'Unknown',
        complete INTEGER DEFAULT 0,
        tasks JSONB DEFAULT '[]'::jsonb
      );
      
      CREATE TABLE servers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        host VARCHAR(255) NOT NULL,
        username VARCHAR(255) NOT NULL,
        port INTEGER DEFAULT 22,
        use_devil BOOLEAN DEFAULT false,
        ssh_password TEXT
      );
      
      CREATE TABLE cli_agents (
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
      
      CREATE TABLE custom_widgets (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        command TEXT NOT NULL,
        type VARCHAR(50) DEFAULT 'number',
        color VARCHAR(50) DEFAULT '#c084fc',
        server_id INTEGER
      );
      
      CREATE TABLE llm_servers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        url VARCHAR(512) NOT NULL,
        api_key TEXT,
        model VARCHAR(255),
        provider VARCHAR(255) DEFAULT 'Custom',
        is_active BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL
      );
    `);
    
    // Create additional tables if missing
    console.log('📝 Creating additional tables...');
    await safeQuery(`
      CREATE TABLE IF NOT EXISTS agents (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        description TEXT,
        server_id INTEGER REFERENCES servers(id),
        status VARCHAR(50) DEFAULT 'stopped',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Default settings seeding
    console.log('📝 Seeding default settings...');
    await safeQuery("INSERT INTO settings (key, value) VALUES ('llmName', 'AtomicChat')");
    await safeQuery("INSERT INTO settings (key, value) VALUES ('llmUrl', 'http://127.0.0.1:1337/v1')");
    await safeQuery("INSERT INTO settings (key, value) VALUES ('llmModel', 'AtomicChat/qwen35-4b-Q8_0')");
    
    console.log('✅ Database migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

runMigrations();
