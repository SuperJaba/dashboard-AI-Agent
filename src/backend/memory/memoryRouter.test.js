import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { memoryRouter } from './memoryRouter.js';
import * as repo from './memoryRepository.js';
import { safeQuery, inMemoryStore, migrate } from '../db.js';

describe('memoryRouter', () => {
  let app;
  let mockIo;

  beforeEach(async () => {
    try {
      await migrate();
    } catch {}

    if (inMemoryStore && inMemoryStore.agent_memories) {
      inMemoryStore.agent_memories = [];
    }
    try {
      await safeQuery('DELETE FROM agent_memories');
    } catch {}

    mockIo = { emit: vi.fn() };
    app = express();
    app.use(express.json());
    app.set('io', mockIo);
    app.use('/api/memory', memoryRouter);
  });

  describe('GET /api/memory', () => {
    it('returns results array matching search query and filters', async () => {
      await repo.saveMemory({
        agent: 'claude-code',
        project: 'ecommerce',
        category: 'backend',
        content: 'Handle Stripe webhook idempotency keys with redis lock.',
        tags: ['stripe', 'redis']
      });

      await repo.saveMemory({
        agent: 'gemini',
        project: 'dashboard',
        category: 'frontend',
        content: 'Use Tailwind CSS v4 @theme configuration.',
        tags: ['tailwind']
      });

      // Search with query
      const res = await request(app).get('/api/memory?q=Stripe');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].agent).toBe('claude-code');
      expect(res.body[0].content).toContain('Stripe webhook');

      // Filter by agent and project
      const filteredRes = await request(app).get('/api/memory?q=Tailwind&agent=gemini&project=dashboard');
      expect(filteredRes.status).toBe(200);
      expect(Array.isArray(filteredRes.body)).toBe(true);
      expect(filteredRes.body).toHaveLength(1);
      expect(filteredRes.body[0].category).toBe('frontend');

      // Check limit
      const limitRes = await request(app).get('/api/memory?limit=1');
      expect(limitRes.status).toBe(200);
      expect(Array.isArray(limitRes.body)).toBe(true);
      expect(limitRes.body.length).toBeLessThanOrEqual(1);
    });
  });

  describe('POST /api/memory', () => {
    it('validates agent and content fields', async () => {
      const resNoAgent = await request(app)
        .post('/api/memory')
        .send({ content: 'Missing agent' });
      expect(resNoAgent.status).toBe(400);
      expect(resNoAgent.body).toHaveProperty('error');

      const resNoContent = await request(app)
        .post('/api/memory')
        .send({ agent: 'claude' });
      expect(resNoContent.status).toBe(400);
      expect(resNoContent.body).toHaveProperty('error');
    });

    it('saves memory via memoryService and returns 201 with saved object and socket emission', async () => {
      const payload = {
        agent: 'claude-code',
        project: 'core-system',
        category: 'architecture',
        content: 'Use domain repository pattern for clean database decoupling.',
        tags: ['architecture', 'ddd']
      };

      const res = await request(app)
        .post('/api/memory')
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.agent).toBe('claude-code');
      expect(res.body.project).toBe('core-system');
      expect(res.body.content).toBe(payload.content);
      expect(res.body.tags).toEqual(['architecture', 'ddd']);

      // Socket emission
      expect(mockIo.emit).toHaveBeenCalledWith('memory:saved', expect.objectContaining({
        id: res.body.id,
        agent: 'claude-code',
        project: 'core-system'
      }));
    });
  });

  describe('GET /api/memory/recent', () => {
    it('returns array of recent memories respecting limit query param', async () => {
      await repo.saveMemory({
        agent: 'agent-1',
        project: 'proj-1',
        category: 'general',
        content: 'Recent entry 1',
        tags: []
      });
      await repo.saveMemory({
        agent: 'agent-2',
        project: 'proj-2',
        category: 'general',
        content: 'Recent entry 2',
        tags: []
      });

      const res = await request(app).get('/api/memory/recent?limit=1');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].content).toBe('Recent entry 2');
    });
  });

  describe('DELETE /api/memory/:id', () => {
    it('deletes memory and returns 200 with { success: true }', async () => {
      const saved = await repo.saveMemory({
        agent: 'to-delete',
        project: 'temp',
        category: 'temp',
        content: 'Ephemeral finding',
        tags: []
      });

      const res = await request(app).delete(`/api/memory/${saved.id}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true });

      const fetched = await repo.getMemory(saved.id);
      expect(fetched).toBeNull();
    });
  });

  describe('POST /api/memory/consolidate', () => {
    it('runs memory consolidation and returns { success: true, deleted: count }', async () => {
      const oldDate = new Date(Date.now() - 40 * 86400 * 1000).toISOString();
      await safeQuery(
        'INSERT INTO agent_memories (id, agent, project, category, content, tags, created_at, access_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        ['obsolete-mem', 'agent-old', 'global', 'old', 'Obsolete rule', '[]', oldDate, 0]
      );

      const res = await request(app)
        .post('/api/memory/consolidate')
        .send({ daysOld: 30, minAccessCount: 1 });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true, deleted: 1 });

      expect(await repo.getMemory('obsolete-mem')).toBeNull();
    });
  });
});
