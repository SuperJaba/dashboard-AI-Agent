import express from 'express';
import { createGhostopsService } from './ghostopsService.js';

export function createGhostopsRouter(ghostopsService) {
  const router = express.Router();

  router.get('/history', (req, res) => {
    try {
      const history = ghostopsService.getHistory();
      res.json({ success: true, history });
    } catch (err) {
      res.status(500).json({ error: err.message || 'Nie udało się pobrać historii Ghost Ops' });
    }
  });

  router.post('/run', async (req, res) => {
    try {
      const hoursBack = req.body?.hoursBack ? Number(req.body.hoursBack) : 24;
      const result = await ghostopsService.runCycle(hoursBack);
      res.json({ success: true, ...result, result });
    } catch (err) {
      res.status(500).json({ error: err.message || 'Błąd podczas wykonywania cyklu Ghost Ops' });
    }
  });

  return router;
}

export const ghostopsRouter = createGhostopsRouter(createGhostopsService());
