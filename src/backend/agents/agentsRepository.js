import { pool } from '../db.js';

export async function getAgents() {
  const { rows } = await pool.query('SELECT * FROM cli_agents ORDER BY name ASC');
  return rows;
}

export async function getAgentById(id) {
  const { rows } = await pool.query('SELECT * FROM cli_agents WHERE id = $1', [id]);
  if (rows.length === 0) return null;
  return rows[0];
}

export async function findAgentByName(name) {
  const { rows } = await pool.query('SELECT * FROM cli_agents WHERE name = $1', [name]);
  if (rows.length === 0) return null;
  return rows[0];
}

export async function createAgent({ name, description, path, config_uri, installed = true, llm_model = 'gpt-4o', temperature = 0.7, max_tokens = 4096 }) {
  const { rows } = await pool.query(
    'INSERT INTO cli_agents (name, description, path, config_uri, installed, llm_model, temperature, max_tokens) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
    [name, description, path, config_uri, installed, llm_model, temperature, max_tokens]
  );
  return rows[0];
}

export async function updateAgentPathAndConfig(name, path, configUri) {
  const { rows } = await pool.query(
    'UPDATE cli_agents SET path = $1, config_uri = COALESCE(NULLIF(config_uri, \'\'), $2), installed = true WHERE name = $3 RETURNING *',
    [path, configUri, name]
  );
  return rows[0];
}

export async function updateAgent(id, fields) {
  const { config_uri, name, description, path: binPath, llm_model, temperature, max_tokens } = fields;
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
  values.push(id);

  const { rows } = await pool.query(query, values);
  return rows[0];
}

export async function updateAgentTunedParams(id, { temperature, max_tokens, llm_model }) {
  const { rows } = await pool.query(
    'UPDATE cli_agents SET temperature = $1, max_tokens = $2, llm_model = $3 WHERE id = $4 RETURNING *',
    [temperature, max_tokens, llm_model, id]
  );
  return rows[0];
}

export async function deleteAgent(id) {
  await pool.query('DELETE FROM cli_agents WHERE id = $1', [id]);
  return { success: true };
}
