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
 * Guardrails:
 * - Requires explicit admin indicator (x-admin-role: true or req.user?.role === 'admin')
 * - Requires explicit confirmation (x-deploy-confirm: DEPLOY_CT8 or confirm === 'DEPLOY_CT8') for production
 */
deployRouter.post('/start', (req, res) => {
  const isAdmin = req.headers['x-admin-role'] === 'true' || req.user?.role === 'admin';
  if (!isAdmin) {
    return res.status(403).json({ error: 'Brak uprawnień administratora (wymagany nagłówek x-admin-role: true).' });
  }

  const environment = req.body?.environment || 'production';
  const workspacePath = req.body?.workspacePath || null;
  const workspaceName = req.body?.workspaceName || null;

  if (environment === 'production') {
    const confirm = req.headers['x-deploy-confirm'] || req.body?.confirm;
    if (confirm !== 'DEPLOY_CT8') {
      return res.status(400).json({ error: 'Wymagane jawne potwierdzenie wdrożenia produkcyjnego (x-deploy-confirm: DEPLOY_CT8).' });
    }
  }

  try {
    const result = deployService.startDeploy({ environment, workspacePath, workspaceName });
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
