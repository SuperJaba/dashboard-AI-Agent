import { Router } from 'express';
import * as memoryService from './memoryService.js';
import * as repo from './memoryRepository.js';

export const memoryRouter = Router();

// GET /api/memory/recent - get recent lessons
memoryRouter.get('/recent', async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 50;
    const memories = await repo.getRecentMemories(limit);
    res.json(memories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/memory - recall/search memories
memoryRouter.get('/', async (req, res) => {
  try {
    const { q = '', agent, project, limit } = req.query;
    const results = await memoryService.recallKnowledge(q, {
      agent: agent || undefined,
      project: project || undefined,
      limit: limit ? parseInt(limit, 10) : undefined
    });
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/memory - save a new knowledge lesson
memoryRouter.post('/', async (req, res) => {
  try {
    const { agent, project, category, content, tags } = req.body || {};
    if (!agent || typeof agent !== 'string' || !agent.trim()) {
      return res.status(400).json({ error: 'Pole "agent" jest wymagane.' });
    }
    if (!content || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ error: 'Pole "content" jest wymagane.' });
    }

    const io = req.app?.get?.('io');
    const memory = await memoryService.saveKnowledgeLesson({
      agent: agent.trim(),
      project: project ? project.trim() : undefined,
      category: category ? category.trim() : undefined,
      content: content.trim(),
      tags: Array.isArray(tags) ? tags : []
    }, { io });

    res.status(201).json(memory);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/memory/consolidate - clean up stale memories
memoryRouter.post('/consolidate', async (req, res) => {
  try {
    const { daysOld, minAccessCount } = req.body || {};
    const result = await memoryService.consolidate({
      daysOld: daysOld !== undefined ? Number(daysOld) : 30,
      minAccessCount: minAccessCount !== undefined ? Number(minAccessCount) : 1
    });
    res.json({ success: true, deleted: result.deleted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/memory/:id - delete a lesson
memoryRouter.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await repo.deleteMemory(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default memoryRouter;
