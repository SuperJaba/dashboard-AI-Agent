import express from 'express';
import {
  createArenaRun,
  getArenaDiff,
  cleanupArena,
  getActiveArenas
} from './arenaRunner.js';

export const arenaRouter = express.Router();

/**
 * POST /api/arena/run
 */
arenaRouter.post('/run', async (req, res) => {
  const { taskId, agentCmd, prompt, repoPath } = req.body || {};

  if (!agentCmd || !prompt) {
    return res.status(400).json({ error: 'agentCmd and prompt are required' });
  }

  try {
    const { runId, arenaPath } = await createArenaRun({
      originalTaskId: taskId,
      agentCmd,
      prompt,
      repoPath
    });

    const io = req.app?.get('io');
    if (io) {
      io.emit('arena:started', { runId, agentCmd, taskId });
    }

    res.status(201).json({ success: true, runId, arenaPath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/arena/runs
 */
arenaRouter.get('/runs', (req, res) => {
  const runs = getActiveArenas();
  res.json({ runs });
});

/**
 * GET /api/arena/runs/:runId/diff
 */
arenaRouter.get('/runs/:runId/diff', (req, res) => {
  try {
    const diff = getArenaDiff(req.params.runId);
    res.json({ diff });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

/**
 * DELETE /api/arena/runs/:runId
 */
arenaRouter.delete('/runs/:runId', (req, res) => {
  try {
    cleanupArena(req.params.runId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
