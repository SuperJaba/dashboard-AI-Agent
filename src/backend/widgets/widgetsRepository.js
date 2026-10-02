import { pool } from '../db.js';

export async function getWidgets() {
  const { rows } = await pool.query('SELECT * FROM custom_widgets ORDER BY id ASC');
  return rows;
}

export async function createWidget({ name, command, type, color, server_id }) {
  const { rows } = await pool.query(
    'INSERT INTO custom_widgets (name, command, type, color, server_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [name, command, type || 'number', color || '#c084fc', server_id || null]
  );
  return rows[0];
}

export async function deleteWidget(id) {
  await pool.query('DELETE FROM custom_widgets WHERE id = $1', [id]);
  return { success: true };
}

export async function getWidgetById(id) {
  const { rows } = await pool.query('SELECT * FROM custom_widgets WHERE id = $1', [id]);
  if (rows.length === 0) {return null;}
  return rows[0];
}

export async function updateWidget(id, { name, command, type, color, server_id }) {
  const { rows } = await pool.query(
    `UPDATE custom_widgets 
     SET name = COALESCE($1, name),
         command = COALESCE($2, command),
         type = COALESCE($3, type),
         color = COALESCE($4, color),
         server_id = $5
     WHERE id = $6 
     RETURNING *`,
    [name, command, type, color, server_id || null, id]
  );
  if (rows.length === 0) {return null;}
  return rows[0];
}
