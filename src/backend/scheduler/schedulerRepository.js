import { safeQuery } from '../db.js';

export async function getScheduledTasks() {
  const { rows } = await safeQuery('SELECT * FROM agent_scheduled_tasks ORDER BY id ASC');
  return rows;
}

export async function getScheduledTaskById(id) {
  const { rows } = await safeQuery('SELECT * FROM agent_scheduled_tasks WHERE id = $1', [id]);
  return rows[0] || null;
}

export async function createScheduledTask({ name, task_type, command, cron_expression, enabled = true, last_status = 'idle' }) {
  const { rows } = await safeQuery(
    'INSERT INTO agent_scheduled_tasks (name, task_type, command, cron_expression, enabled, last_status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
    [name, task_type, command, cron_expression, enabled, last_status]
  );
  return rows[0];
}

export async function updateScheduledTask(id, { name, task_type, command, cron_expression, enabled }) {
  const { rows } = await safeQuery(
    'UPDATE agent_scheduled_tasks SET name = $1, task_type = $2, command = $3, cron_expression = $4, enabled = $5 WHERE id = $6 RETURNING *',
    [name, task_type, command, cron_expression, enabled, id]
  );
  return rows[0] || null;
}

export async function setScheduledTaskEnabled(id, enabled) {
  const { rows } = await safeQuery(
    'UPDATE agent_scheduled_tasks SET enabled = $1 WHERE id = $2 RETURNING *',
    [enabled, id]
  );
  return rows[0] || null;
}

export async function recordTaskRun(id, { last_run, last_status, last_output }) {
  const { rows } = await safeQuery(
    'UPDATE agent_scheduled_tasks SET last_run = $1, last_status = $2, last_output = $3 WHERE id = $4 RETURNING *',
    [last_run, last_status, last_output, id]
  );
  return rows[0] || null;
}

export async function deleteScheduledTask(id) {
  await safeQuery('DELETE FROM agent_scheduled_tasks WHERE id = $1', [id]);
  return { success: true };
}
