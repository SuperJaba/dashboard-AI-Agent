import * as repo from './memoryRepository.js';

export async function saveKnowledgeLesson(lesson, { io } = {}) {
  const memory = await repo.saveMemory(lesson);
  io?.emit('memory:saved', {
    id: memory.id,
    agent: memory.agent,
    project: memory.project,
    category: memory.category,
    preview: (memory.content || '').slice(0, 100)
  });
  return memory;
}

export const rememberLesson = saveKnowledgeLesson;

export async function recallKnowledge(query, filters = {}) {
  const results = await repo.searchMemories(query, filters);
  await Promise.all(results.map(r => repo.incrementAccessCount(r.id)));
  return results;
}

export const recallContext = recallKnowledge;

export async function consolidate({ daysOld = 30, minAccessCount = 1 } = {}) {
  const cutoff = new Date(Date.now() - daysOld * 86400 * 1000).toISOString();
  const res = await repo.safeQuery(
    'SELECT id FROM agent_memories WHERE created_at < ? AND access_count < ?',
    [cutoff, minAccessCount]
  );
  const rows = res?.rows || (Array.isArray(res) ? res : []);
  for (const row of rows) {
    await repo.deleteMemory(row.id);
  }
  return { deleted: rows.length };
}

export function formatAsSystemPromptAddition(memories = []) {
  if (!memories || !memories.length) return '';
  const lines = memories.map(m => `- [${m.agent}][${m.category}] ${m.content}`);
  return `\n\n## Accumulated Agent Knowledge (${memories.length} lessons)\n${lines.join('\n')}`;
}
