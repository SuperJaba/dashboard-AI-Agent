import { Router } from 'express';
import { safeQuery } from '../db.js';
import * as snapshotService from './snapshotService.js';
import * as restoreService from './snapshotRestoreService.js';

export const timemachineRouter = Router();

// GET /api/timemachine/sessions - list all recorded agent snapshot sessions
timemachineRouter.get('/sessions', async (req, res) => {
  try {
    const { rows } = await safeQuery('SELECT * FROM snapshot_sessions ORDER BY started_at DESC');
    res.json(rows || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/timemachine/sessions/:id/events - get chronological session event timeline
timemachineRouter.get('/sessions/:id/events', async (req, res) => {
  try {
    const events = await snapshotService.getEvents(req.params.id);
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/timemachine/sessions/:id/rollback - rollback session to target sequence or timestamp
timemachineRouter.post('/sessions/:id/rollback', async (req, res) => {
  try {
    const { seq, timestamp } = req.body;
    if (seq === undefined && timestamp === undefined) {
      return res.status(400).json({ error: 'Należy podać parametr "seq" lub "timestamp" do wycofania zmian.' });
    }

    let results = [];
    if (seq !== undefined) {
      results = await restoreService.rollbackToEvent(req.params.id, seq);
    } else {
      results = await restoreService.rollbackToTimestamp(req.params.id, timestamp);
    }

    res.json({
      success: true,
      sessionId: req.params.id,
      revertedFiles: results
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default timemachineRouter;
