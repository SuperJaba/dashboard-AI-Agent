import { pool } from '../db.js';
import { encrypt, decrypt } from '../utils/crypto.js';

export async function getSettings() {
  const { rows } = await pool.query('SELECT key, value FROM settings');
  const settings = {};
  for (const row of (rows || [])) {
    if (row.key === 'apiKey' && row.value) {
      try {
        settings[row.key] = decrypt(row.value);
      } catch (e) {
        settings[row.key] = row.value;
      }
    } else {
      settings[row.key] = row.value;
    }
  }
  return settings;
}

export async function saveSettings({ llmUrl, apiKey, llmName, llmModel, useBrowserTerminal }) {
  if (llmUrl !== undefined) {
    await pool.query(
      'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
      ['llmUrl', llmUrl]
    );
  }
  if (apiKey !== undefined) {
    await pool.query(
      'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
      ['apiKey', encrypt(apiKey)]
    );
  }
  if (llmName !== undefined) {
    await pool.query(
      'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
      ['llmName', llmName]
    );
  }
  if (llmModel !== undefined) {
    await pool.query(
      'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
      ['llmModel', llmModel]
    );
  }
  if (useBrowserTerminal !== undefined) {
    await pool.query(
      'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
      ['useBrowserTerminal', String(useBrowserTerminal)]
    );
  }
  return { success: true };
}

export async function getLlmCredentials() {
  const settingsRes = await pool.query("SELECT key, value FROM settings WHERE key IN ('llmUrl', 'apiKey')");
  let llmUrl = '';
  let apiKey = '';
  (settingsRes.rows || []).forEach(r => {
    if (r.key === 'llmUrl') {llmUrl = r.value || '';}
    if (r.key === 'apiKey' && r.value) {
      try {
        apiKey = decrypt(r.value);
      } catch (e) {
        apiKey = r.value;
      }
    }
  });
  return { llmUrl, apiKey };
}

