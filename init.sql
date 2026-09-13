-- Database initialization for Dashboard
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (
  key VARCHAR(255) PRIMARY KEY,
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
  tasks JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS servers (
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
);

CREATE TABLE IF NOT EXISTS llm_servers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  url VARCHAR(512) NOT NULL,
  api_key TEXT,
  model VARCHAR(255),
  provider VARCHAR(255) DEFAULT 'Custom',
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cli_agents (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  path TEXT,
  config_uri TEXT,
  installed BOOLEAN DEFAULT true,
  llm_model VARCHAR(255) DEFAULT 'gpt-4o',
  temperature FLOAT DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 4096,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS custom_widgets (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  command TEXT NOT NULL,
  type VARCHAR(50) DEFAULT 'number',
  color VARCHAR(50) DEFAULT '#c084fc',
  server_id INTEGER REFERENCES servers(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed initial settings
INSERT INTO settings (key, value) VALUES
  ('llmName', 'AtomicChat'),
  ('llmUrl', 'http://127.0.0.1:1337/v1'),
  ('llmModel', 'AtomicChat/qwen35-4b-Q8_0')
ON CONFLICT (key) DO NOTHING;
