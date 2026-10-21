import { pool } from '../db.js';

const DEFAULTS = { theme: 'dark', language: 'pl' };

export async function getUserSettings(userId) {
  const { rows } = await pool.query('SELECT theme, language FROM user_settings WHERE user_id = $1', [userId]);
  if (rows.length === 0) {return { ...DEFAULTS };}
  return {
    theme: rows[0].theme || DEFAULTS.theme,
    language: rows[0].language || DEFAULTS.language,
  };
}

export async function saveUserSettings(userId, { theme, language }) {
  const { rows } = await pool.query(
    `INSERT INTO user_settings (user_id, theme, language)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id) DO UPDATE SET
       theme = COALESCE(EXCLUDED.theme, user_settings.theme),
       language = COALESCE(EXCLUDED.language, user_settings.language),
       updated_at = CURRENT_TIMESTAMP
     RETURNING theme, language`,
    [userId, theme ?? null, language ?? null]
  );
  return rows[0];
}
