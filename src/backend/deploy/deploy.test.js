import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { deployService } from './deployService.js';
import { deployRouter } from './deployRouter.js';

describe('DeployService', () => {
  beforeEach(() => {
    deployService.state = 'IDLE';
    deployService.currentStep = 'Oczekiwanie na uruchomienie';
    deployService.logs = [];
    deployService.activeProcess = null;
  });

  it('initializes with default status', () => {
    const status = deployService.getStatus();
    expect(status.state).toBe('IDLE');
    expect(status.isDeploying).toBe(false);
    expect(status.targetHost).toBe('dashboard.jagger2.ct8.pl');
    expect(Array.isArray(status.logs)).toBe(true);
  });

  it('appends logs correctly and updates step on parseStep', () => {
    deployService.appendLog('Deployment test log');
    expect(deployService.logs.length).toBe(1);
    expect(deployService.logs[0].text).toBe('Deployment test log');

    deployService.parseStep('======================================== STEP 2: Deploy Production Code via SSH');
    expect(deployService.currentStep).toContain('Krok 2: Wysyłanie plików');
  });

  it('rejects starting deployment if already in RUNNING state', () => {
    deployService.state = 'RUNNING';
    expect(() => deployService.startDeploy()).toThrow('Wdrożenie jest już w toku.');
  });

  it('records healthcheck successfully on ok response', async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 'UP', message: 'Healthy' }),
    });

    try {
      const health = await deployService.checkHealth('http://localhost:9999/health');
      expect(health.healthy).toBe(true);
      expect(health.statusCode).toBe(200);
      expect(health.details).toEqual({ status: 'UP', message: 'Healthy' });
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('handles healthcheck failure gracefully', async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));

    try {
      const health = await deployService.checkHealth('http://localhost:9999/health');
      expect(health.healthy).toBe(false);
      expect(health.error).toBe('Connection refused');
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('DeployRouter API', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/deploy', deployRouter);

  it('GET /api/deploy/status returns deployment status', async () => {
    const res = await request(app).get('/api/deploy/status');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('state');
    expect(res.body).toHaveProperty('isDeploying');
    expect(res.body.targetHost).toBe('dashboard.jagger2.ct8.pl');
  });

  it('GET /api/deploy/logs returns logs array', async () => {
    deployService.logs = [{ timestamp: '12:00:00', text: 'Sample log line' }];
    const res = await request(app).get('/api/deploy/logs');
    expect(res.status).toBe(200);
    expect(res.body.logs.length).toBe(1);
    expect(res.body.logs[0].text).toBe('Sample log line');
  });
});
