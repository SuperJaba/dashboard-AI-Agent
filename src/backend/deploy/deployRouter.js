import express from 'express';
import { deployService } from './deployService.js';
import * as serversRepo from '../servers/serversRepository.js';

export const deployRouter = express.Router();

/**
 * GET /api/deploy/targets
 * Returns list of available remote targets for deployment.
 */
deployRouter.get('/targets', async (req, res) => {
  try {
    const baseTargets = [
      {
        id: 'ct8',
        name: 'CT8.pl (FreeBSD Production)',
        host: 'dashboard.jagger2.ct8.pl',
        type: 'ct8',
        default: true,
      },
      {
        id: 'omv',
        name: 'OMV (OpenMediaVault Linux)',
        host: '10.10.10.100',
        type: 'omv',
        default: false,
      },
    ];

    try {
      const extraServers = await serversRepo.getServers();
      if (Array.isArray(extraServers)) {
        for (const s of extraServers) {
          if (s.host && !baseTargets.some((b) => b.host === s.host)) {
            baseTargets.push({
              id: `custom_${s.id}`,
              name: s.name || s.host,
              host: s.host,
              type: s.use_devil ? 'ct8' : 'linux',
              default: false,
            });
          }
        }
      }
    } catch {
      // If db not available, baseTargets are still returned
    }

    res.json(baseTargets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/deploy/status
 * Returns current deployment status, step, targets, and last deployment record.
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
 * Triggers deployment to one or more targets (CT8, OMV, custom).
 * Guardrails:
 * - Requires explicit admin indicator (x-admin-role: true or req.user?.role === 'admin')
 * - Requires explicit confirmation (x-deploy-confirm: DEPLOY_CT8 or confirm === 'DEPLOY_CT8') for production CT8
 */
deployRouter.post('/start', (req, res) => {
  const isAdmin = req.headers['x-admin-role'] === 'true' || req.user?.role === 'admin';
  if (!isAdmin) {
    return res.status(403).json({ error: 'Brak uprawnień administratora (wymagany nagłówek x-admin-role: true).' });
  }

  const environment = req.body?.environment || 'production';
  const targets = Array.isArray(req.body?.targets) && req.body.targets.length > 0
    ? req.body.targets
    : ['ct8'];

  if (environment === 'production' && targets.includes('ct8')) {
    const confirm = req.headers['x-deploy-confirm'] || req.body?.confirm;
    if (confirm !== 'DEPLOY_CT8') {
      return res.status(400).json({ error: 'Wymagane jawne potwierdzenie wdrożenia produkcyjnego (x-deploy-confirm: DEPLOY_CT8).' });
    }
  }

  try {
    const result = deployService.startDeploy({ environment, targets });
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

/**
 * POST /api/deploy/abort
 * Kills any active deployment processes and marks status as aborted.
 */
deployRouter.post('/abort', (req, res) => {
  const isAdmin = req.headers['x-admin-role'] === 'true' || req.user?.role === 'admin';
  if (!isAdmin) {
    return res.status(403).json({ error: 'Brak uprawnień administratora.' });
  }

  try {
    const result = deployService.abortDeploy();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/deploy/kill-remote
 * Connects over SSH to target (defaults to CT8) and kills hung processes (node, gitstatusd, etc.)
 * then triggers application restart (devil www restart).
 */
deployRouter.post('/kill-remote', async (req, res) => {
  const isAdmin = req.headers['x-admin-role'] === 'true' || req.user?.role === 'admin';
  if (!isAdmin) {
    return res.status(403).json({ error: 'Brak uprawnień administratora.' });
  }

  const target = req.body?.target || 'ct8';
  try {
    const result = await deployService.killRemoteProcesses({ target });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
