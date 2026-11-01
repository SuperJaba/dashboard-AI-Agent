import crypto from 'crypto';
import { safeQuery } from '../db.js';

function normalizeRows(res) {
  if (!res) return [];
  if (Array.isArray(res)) return res;
  if (Array.isArray(res.rows)) return res.rows;
  return [];
}

function parseMemoryRow(row) {
  if (!row) return null;
  let parsedTags = [];
  try {
    parsedTags = typeof row.tags === 'string' ? JSON.parse(row.tags) : (row.tags || []);
  } catch {
    parsedTags = [];
  }
  return {
    ...row,
    access_count: Number(row.access_count) || 0,
    tags: parsedTags
  };
}

export async function saveMemory({ agent, project, category, content, tags = [] }) {
  const id = crypto.randomUUID();
  const serializedTags = typeof tags === 'string' ? tags : JSON.stringify(tags);
  const now = new Date().toISOString();

  await safeQuery(
    'INSERT INTO agent_memories (id, agent, project, category, content, tags, created_at, access_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [id, agent, project ?? 'global', category ?? 'general', content, serializedTags, now, 0]
  );

  return getMemory(id);
}

export async function getMemory(id) {
  const res = await safeQuery('SELECT * FROM agent_memories WHERE id=?', [id]);
  const rows = normalizeRows(res);
  if (!rows[0]) return null;
  return parseMemoryRow(rows[0]);
}

export async function searchMemories(query, { agent, project, limit = 20 } = {}) {
  const conditions = ['content LIKE ?'];
  const params = [`%${query}%`];

  if (agent) {
    conditions.push('agent=?');
    params.push(agent);
  }
  if (project) {
    conditions.push('project=?');
    params.push(project);
  }

  params.push(limit);

  const res = await safeQuery(
    `SELECT * FROM agent_memories WHERE ${conditions.join(' AND ')} ORDER BY access_count DESC, created_at DESC LIMIT ?`,
    params
  );
  const rows = normalizeRows(res);
  return rows.map(parseMemoryRow).filter(Boolean);
}

export async function getRecentMemories(limit = 50) {
  const res = await safeQuery('SELECT * FROM agent_memories ORDER BY created_at DESC LIMIT ?', [limit]);
  const rows = normalizeRows(res);
  return rows.map(parseMemoryRow).filter(Boolean);
}

export async function deleteMemory(id) {
  await safeQuery('DELETE FROM agent_memories WHERE id=?', [id]);
}

export async function incrementAccessCount(id) {
  await safeQuery('UPDATE agent_memories SET access_count = access_count + 1 WHERE id=?', [id]);
}

export { safeQuery };
