import express from 'express';
import { deployService } from './deployService.js';

export const deployRouter = express.Router();

/**
 * GET /api/deploy/status
 * Returns current deployment status, step, and last deployment record.
 */
deployRouter.get('/status', (req, res) => {
  try {
    const status = deployService.getStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/deploy/health
 * Probes the live CT8 host /health endpoint and returns response time & status.
 */
deployRouter.get('/health', async (req, res) => {
  try {
    const health = await deployService.checkHealth();
    res.json(health);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/deploy/start
 * Triggers the automated deployment to CT8.
 */
deployRouter.post('/start', (req, res) => {
  try {
    const environment = req.body?.environment || 'production';
    const result = deployService.startDeploy({ environment });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/deploy/logs
 * Returns buffered lines of logs from the current or last deployment.
 */
deployRouter.get('/logs', (req, res) => {
  try {
    res.json({ logs: deployService.logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
