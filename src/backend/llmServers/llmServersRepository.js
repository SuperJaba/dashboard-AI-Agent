import { pool } from '../db.js';
import { encrypt, decrypt } from '../utils/crypto.js';
import { saveSettings } from '../settings/settingsRepository.js';

export async function getLlmServers() {
  const { rows } = await pool.query('SELECT * FROM llm_servers ORDER BY is_active DESC, id');
  return (rows || []).map(server => {
    let decryptedKey = server.api_key || '';
    if (decryptedKey) {
      try {
        decryptedKey = decrypt(decryptedKey);
      } catch (e) {
        decryptedKey = server.api_key;
      }
    }
    return { ...server, api_key: decryptedKey };
  });
}

export async function createLlmServer({ name, url, apiKey, model, provider, is_active }) {
  const encryptedKey = apiKey ? encrypt(apiKey) : '';
  const { rows } = await pool.query(
    `INSERT INTO llm_servers (name, url, api_key, model, provider, is_active)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [name, url, encryptedKey, model || '', provider || 'Custom', is_active || false]
  );
  
  if (is_active) {
    await selectLlmServer(rows[0].id);
  }
  
  return rows[0];
}

export async function updateLlmServer(id, { name, url, apiKey, model, provider, is_active }) {
  const updates = [];
  const values = [];
  let paramIdx = 1;

  if (name !== undefined) {
    updates.push(`name = $${paramIdx++}`);
    values.push(name);
  }
  if (url !== undefined) {
    updates.push(`url = $${paramIdx++}`);
    values.push(url);
  }
  if (apiKey !== undefined) {
    updates.push(`api_key = $${paramIdx++}`);
    values.push(apiKey ? encrypt(apiKey) : '');
  }
  if (model !== undefined) {
    updates.push(`model = $${paramIdx++}`);
    values.push(model);
  }
  if (provider !== undefined) {
    updates.push(`provider = $${paramIdx++}`);
    values.push(provider);
  }
  if (is_active !== undefined) {
    updates.push(`is_active = $${paramIdx++}`);
    values.push(is_active);
  }

  if (updates.length > 0) {
    values.push(id);
    const query = `UPDATE llm_servers SET ${updates.join(', ')} WHERE id = $${paramIdx} RETURNING *`;
    const { rows } = await pool.query(query, values);
    if (is_active) {
      await selectLlmServer(id);
    }
    return rows[0];
  }

  const { rows } = await pool.query('SELECT * FROM llm_servers WHERE id = $1', [id]);
  return rows[0];
}

export async function deleteLlmServer(id) {
  await pool.query('DELETE FROM llm_servers WHERE id = $1', [id]);
  return { success: true };
}

export async function selectLlmServer(id) {
  await pool.query('UPDATE llm_servers SET is_active = false');
  const { rows } = await pool.query('UPDATE llm_servers SET is_active = true WHERE id = $1 RETURNING *', [id]);
  
  if (rows.length > 0) {
    const selected = rows[0];
    let apiKey = selected.api_key || '';
    if (apiKey) {
      try {
        apiKey = decrypt(apiKey);
      } catch (e) {}
    }
    await saveSettings({
      llmUrl: selected.url,
      apiKey: apiKey,
      llmName: selected.provider || selected.name,
      llmModel: selected.model || ''
    });
  }
  
  return rows[0] || null;
}

export async function importLlmServers(servers) {
  if (!Array.isArray(servers)) return [];
  const imported = [];
  for (const s of servers) {
    if (s.name && s.url) {
      const server = await createLlmServer({
        name: s.name,
        url: s.url,
        apiKey: s.api_key || s.apiKey || '',
        model: s.model || '',
        provider: s.provider || s.llmName || 'Custom',
        is_active: s.is_active || false
      });
      imported.push(server);
    }
  }
  return imported;
}
