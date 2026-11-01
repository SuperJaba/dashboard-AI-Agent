import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import * as service from './memoryService.js';
import * as repo from './memoryRepository.js';
import { safeQuery, inMemoryStore, migrate } from '../db.js';

describe('memoryService', () => {
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

  it('saveKnowledgeLesson persists lesson and emits memory:saved on socket', async () => {
    const mockIo = {
      emit: vi.fn()
    };

    const lessonData = {
      agent: 'claude-code',
      project: 'dashboard',
      category: 'resilience',
      content: 'Always mock external network boundaries during integration tests.',
      tags: ['testing', 'mock']
    };

    const saved = await service.saveKnowledgeLesson(lessonData, { io: mockIo });

    expect(saved).toBeDefined();
    expect(saved.id).toBeDefined();
    expect(saved.agent).toBe('claude-code');
    expect(saved.content).toBe(lessonData.content);

    // Verify persisted in repository
    const fetched = await repo.getMemory(saved.id);
    expect(fetched).toBeDefined();
    expect(fetched.content).toBe(lessonData.content);

    // Verify socket emission
    expect(mockIo.emit).toHaveBeenCalledTimes(1);
    expect(mockIo.emit).toHaveBeenCalledWith('memory:saved', expect.objectContaining({
      id: saved.id,
      agent: 'claude-code',
      project: 'dashboard',
      category: 'resilience',
      preview: expect.stringContaining('Always mock external network boundaries')
    }));
  });

  it('saveKnowledgeLesson works gracefully when io is undefined', async () => {
    const lessonData = {
      agent: 'gemini',
      project: 'global',
      category: 'general',
      content: 'Stand-alone learning without active socket connections.',
      tags: ['standalone']
    };

    const saved = await service.saveKnowledgeLesson(lessonData);
    expect(saved).toBeDefined();
    expect(saved.id).toBeDefined();
  });

  it('recallKnowledge searches memories and increments access_count on recalled items', async () => {
    const mem1 = await repo.saveMemory({
      agent: 'claude-code',
      project: 'ecommerce',
      category: 'payment',
      content: 'Stripe webhook signature validation requires raw buffer body.',
      tags: ['stripe', 'webhooks']
    });

    const mem2 = await repo.saveMemory({
      agent: 'antigravity',
      project: 'ecommerce',
      category: 'shipping',
      content: 'InPost Locker geocoding requires lat/lng precision of 6 decimals.',
      tags: ['inpost', 'geo']
    });

    // Check initial access count
    expect(mem1.access_count).toBe(0);
    expect(mem2.access_count).toBe(0);

    // Recall knowledge matching 'Stripe'
    const results = await service.recallKnowledge('Stripe', { project: 'ecommerce' });
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(mem1.id);

    // Verify access_count was incremented in repo
    const updatedMem1 = await repo.getMemory(mem1.id);
    expect(updatedMem1.access_count).toBe(1);

    const untouchedMem2 = await repo.getMemory(mem2.id);
    expect(untouchedMem2.access_count).toBe(0);

    // Recalling again should increment to 2
    await service.recallKnowledge('Stripe');
    const updatedMem1Twice = await repo.getMemory(mem1.id);
    expect(updatedMem1Twice.access_count).toBe(2);
  });

  it('consolidate cleans up stale, rarely accessed memories', async () => {
    const oldDate = new Date(Date.now() - 40 * 86400 * 1000).toISOString();
    const recentDate = new Date().toISOString();

    // Stale memory: old and 0 access count
    await safeQuery(
      'INSERT INTO agent_memories (id, agent, project, category, content, tags, created_at, access_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      ['old-stale-id', 'agent-old', 'global', 'old', 'Obsolete rule', '[]', oldDate, 0]
    );

    // Valuable memory: old but accessed 5 times
    await safeQuery(
      'INSERT INTO agent_memories (id, agent, project, category, content, tags, created_at, access_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      ['old-valuable-id', 'agent-old', 'global', 'important', 'Durable principle', '[]', oldDate, 5]
    );

    // Fresh memory: recent and 0 access count
    await safeQuery(
      'INSERT INTO agent_memories (id, agent, project, category, content, tags, created_at, access_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      ['fresh-id', 'agent-fresh', 'global', 'fresh', 'Fresh learning', '[]', recentDate, 0]
    );

    const result = await service.consolidate({ daysOld: 30, minAccessCount: 1 });
    expect(result.deleted).toBe(1);

    expect(await repo.getMemory('old-stale-id')).toBeNull();
    expect(await repo.getMemory('old-valuable-id')).toBeDefined();
    expect(await repo.getMemory('fresh-id')).toBeDefined();
  });

  it('formatAsSystemPromptAddition formats memories into prompt section', () => {
    expect(service.formatAsSystemPromptAddition([])).toBe('');

    const formatted = service.formatAsSystemPromptAddition([
      { agent: 'claude-code', category: 'db', content: 'Use safeQuery for fallback' },
      { agent: 'gemini', category: 'ui', content: 'Tailwind v4 uses @theme' }
    ]);

    expect(formatted).toContain('## Accumulated Agent Knowledge (2 lessons)');
    expect(formatted).toContain('- [claude-code][db] Use safeQuery for fallback');
    expect(formatted).toContain('- [gemini][ui] Tailwind v4 uses @theme');
  });
});
