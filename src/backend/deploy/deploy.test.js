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

  it('strips ANSI color escape sequences and orphaned [0m codes', () => {
    deployService.appendLog('\u001b[32m[OK] Files synchronized\u001b[0m');
    expect(deployService.logs[deployService.logs.length - 1].text).toBe('[OK] Files synchronized');

    // Lone ANSI reset like [0m should be stripped and not add empty lines
    const prevCount = deployService.logs.length;
    deployService.appendLog('[0m');
    expect(deployService.logs.length).toBe(prevCount);
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

  it('POST /api/deploy/start returns 403 when admin indicator is missing', async () => {
    const res = await request(app).post('/api/deploy/start').send({ environment: 'production' });
    expect(res.status).toBe(403);
    expect(res.body.error).toContain('uprawnień administratora');
  });

  it('POST /api/deploy/start returns 400 when production confirmation is missing', async () => {
    const res = await request(app)
      .post('/api/deploy/start')
      .set('x-admin-role', 'true')
      .send({ environment: 'production' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('jawne potwierdzenie');
  });

  it('POST /api/deploy/start succeeds with admin role and confirmation', async () => {
    vi.spyOn(deployService, 'startDeploy').mockReturnValue({ success: true, message: 'Wdrożenie uruchomione' });

    const res = await request(app)
      .post('/api/deploy/start')
      .set('x-admin-role', 'true')
      .set('x-deploy-confirm', 'DEPLOY_CT8')
      .send({ environment: 'production' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('GET /api/deploy/targets returns available deploy targets including ct8 and omv', async () => {
    const res = await request(app).get('/api/deploy/targets');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some(t => t.id === 'ct8')).toBe(true);
    expect(res.body.some(t => t.id === 'omv')).toBe(true);
  });

  it('POST /api/deploy/start supports multi-target deployment', async () => {
    const spy = vi.spyOn(deployService, 'startDeploy').mockReturnValue({
      success: true,
      message: 'Wdrożenie uruchomione na cele: ct8, omv',
      targets: ['ct8', 'omv'],
    });

    const res = await request(app)
      .post('/api/deploy/start')
      .set('x-admin-role', 'true')
      .set('x-deploy-confirm', 'DEPLOY_CT8')
      .send({ environment: 'production', targets: ['ct8', 'omv'] });

    expect(res.status).toBe(200);
    expect(spy).toHaveBeenCalledWith({
      environment: 'production',
      targets: ['ct8', 'omv'],
    });
  });

  it('POST /api/deploy/abort returns 403 when not admin', async () => {
    const res = await request(app).post('/api/deploy/abort');
    expect(res.status).toBe(403);
    expect(res.body.error).toContain('uprawnień administratora');
  });

  it('POST /api/deploy/abort calls deployService.abortDeploy', async () => {
    const spy = vi.spyOn(deployService, 'abortDeploy').mockReturnValue({
      success: true,
      message: 'Procesy wdrożenia zatrzymane.',
    });

    const res = await request(app)
      .post('/api/deploy/abort')
      .set('x-admin-role', 'true');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(spy).toHaveBeenCalled();
  });

  it('POST /api/deploy/kill-remote returns 403 when not admin', async () => {
    const res = await request(app).post('/api/deploy/kill-remote');
    expect(res.status).toBe(403);
    expect(res.body.error).toContain('uprawnień administratora');
  });

  it('POST /api/deploy/kill-remote calls deployService.killRemoteProcesses with target', async () => {
    const spy = vi.spyOn(deployService, 'killRemoteProcesses').mockResolvedValue({
      success: true,
      message: 'Zawieszone procesy zdalne na CT8 zostały ubite.',
    });

    const res = await request(app)
      .post('/api/deploy/kill-remote')
      .set('x-admin-role', 'true')
      .send({ target: 'ct8' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(spy).toHaveBeenCalledWith({ target: 'ct8' });
  });
});
