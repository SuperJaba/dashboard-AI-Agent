import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import * as repo from './memoryRepository.js';
import { safeQuery, inMemoryStore, migrate } from '../db.js';

describe('memoryRepository', () => {
  beforeAll(async () => {
    try {
      await migrate();
    } catch {}
  });

  beforeEach(async () => {
    if (inMemoryStore && inMemoryStore.agent_memories) {
      inMemoryStore.agent_memories = [];
    }
    try {
      await safeQuery('DELETE FROM agent_memories');
    } catch {}
  });

  it('saveMemory returns memory with id and parsed tags array', async () => {
    const memory = await repo.saveMemory({
      agent: 'claude-code',
      project: 'dashboard',
      category: 'database',
      content: 'Always wrap pool.query calls in safeQuery for in-memory fallback.',
      tags: ['db', 'resilience', 'postgres']
    });

    expect(memory).toBeDefined();
    expect(memory.id).toBeDefined();
    expect(typeof memory.id).toBe('string');
    expect(memory.agent).toBe('claude-code');
    expect(memory.project).toBe('dashboard');
    expect(memory.category).toBe('database');
    expect(memory.content).toBe('Always wrap pool.query calls in safeQuery for in-memory fallback.');
    expect(Array.isArray(memory.tags)).toBe(true);
    expect(memory.tags).toEqual(['db', 'resilience', 'postgres']);
    expect(memory.access_count).toBe(0);
    expect(memory.created_at).toBeDefined();
  });

  it('getMemory returns memory by id and null for non-existent id', async () => {
    const saved = await repo.saveMemory({
      agent: 'antigravity',
      project: 'global',
      category: 'architecture',
      content: 'Decouple state logic into separate custom hooks.',
      tags: ['react', 'hooks']
    });

    const fetched = await repo.getMemory(saved.id);
    expect(fetched).toBeDefined();
    expect(fetched.id).toBe(saved.id);
    expect(fetched.agent).toBe('antigravity');
    expect(fetched.content).toBe('Decouple state logic into separate custom hooks.');
    expect(fetched.tags).toEqual(['react', 'hooks']);

    const nonExistent = await repo.getMemory('non-existent-uuid');
    expect(nonExistent).toBeNull();
  });

  it('searchMemories returns matching memories with agent and project filtering', async () => {
    await repo.saveMemory({
      agent: 'claude-code',
      project: 'proj-a',
      category: 'backend',
      content: 'PostgreSQL connection timeout can be handled by reconnection retries.',
      tags: ['postgres', 'timeout']
    });

    await repo.saveMemory({
      agent: 'gemini',
      project: 'proj-b',
      category: 'frontend',
      content: 'Use Tailwind CSS v4 @theme directive instead of tailwind.config.js.',
      tags: ['css', 'tailwind']
    });

    await repo.saveMemory({
      agent: 'claude-code',
      project: 'proj-b',
      category: 'backend',
      content: 'PostgreSQL safeQuery returns { rows } and handles inMemoryStore fallback.',
      tags: ['postgres', 'fallback']
    });

    // Search query match
    const postgresMatches = await repo.searchMemories('PostgreSQL');
    expect(postgresMatches.length).toBe(2);

    // Filter by agent and project
    const filtered = await repo.searchMemories('PostgreSQL', {
      agent: 'claude-code',
      project: 'proj-a'
    });
    expect(filtered.length).toBe(1);
    expect(filtered[0].project).toBe('proj-a');

    // Limit check
    const limited = await repo.searchMemories('PostgreSQL', { limit: 1 });
    expect(limited.length).toBe(1);
  });

  it('getRecentMemories returns latest records ordered by created_at DESC', async () => {
    const mem1 = await repo.saveMemory({
      agent: 'agent-1',
      project: 'p1',
      category: 'cat1',
      content: 'First saved lesson',
      tags: ['first']
    });

    const mem2 = await repo.saveMemory({
      agent: 'agent-2',
      project: 'p2',
      category: 'cat2',
      content: 'Second saved lesson',
      tags: ['second']
    });

    const recent = await repo.getRecentMemories(10);
    expect(recent.length).toBeGreaterThanOrEqual(2);
    // Recent memories should be ordered by created_at DESC
    const ids = recent.map(r => r.id);
    expect(ids.indexOf(mem2.id)).toBeLessThan(ids.indexOf(mem1.id));

    const singleRecent = await repo.getRecentMemories(1);
    expect(singleRecent.length).toBe(1);
    expect(singleRecent[0].id).toBe(mem2.id);
  });

  it('incrementAccessCount increments access_count', async () => {
    const saved = await repo.saveMemory({
      agent: 'agent-x',
      project: 'global',
      category: 'general',
      content: 'A frequently recalled pattern',
      tags: ['pattern']
    });

    expect(saved.access_count).toBe(0);

    await repo.incrementAccessCount(saved.id);
    const fetched1 = await repo.getMemory(saved.id);
    expect(fetched1.access_count).toBe(1);

    await repo.incrementAccessCount(saved.id);
    const fetched2 = await repo.getMemory(saved.id);
    expect(fetched2.access_count).toBe(2);
  });

  it('deleteMemory removes record', async () => {
    const saved = await repo.saveMemory({
      agent: 'temporary-agent',
      project: 'temp',
      category: 'temp',
      content: 'Transient discovery to be removed',
      tags: ['temp']
    });

    expect(await repo.getMemory(saved.id)).toBeDefined();

    await repo.deleteMemory(saved.id);
    expect(await repo.getMemory(saved.id)).toBeNull();
  });
});
