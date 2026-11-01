import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { arenaRouter } from './arenaRouter.js';
import * as arenaRunner from './arenaRunner.js';

describe('arenaRouter', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/arena', arenaRouter);
    arenaRunner.clearActiveArenas();
  });

  it('POST /api/arena/run validates required fields and starts arena', async () => {
    vi.spyOn(arenaRunner, 'createArenaRun').mockResolvedValue({
      runId: 'arena-test-1',
      arenaPath: '/tmp/arena-test-1'
    });

    const res = await request(app)
      .post('/api/arena/run')
      .send({ taskId: 't1', agentCmd: 'gemini', prompt: 'Solve bug' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual(expect.objectContaining({ success: true, runId: 'arena-test-1' }));
  });

  it('POST /api/arena/run returns 400 when missing prompt or agentCmd', async () => {
    const res = await request(app)
      .post('/api/arena/run')
      .send({ taskId: 't1' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('GET /api/arena/runs returns list of active arenas', async () => {
    vi.spyOn(arenaRunner, 'getActiveArenas').mockReturnValue([
      { runId: 'run-1', agent: 'claude', status: 'running' }
    ]);

    const res = await request(app).get('/api/arena/runs');
    expect(res.status).toBe(200);
    expect(res.body.runs).toHaveLength(1);
    expect(res.body.runs[0].runId).toBe('run-1');
  });

  it('GET /api/arena/runs/:runId/diff returns unified diff', async () => {
    vi.spyOn(arenaRunner, 'getArenaDiff').mockReturnValue('diff --git a/test.js b/test.js');

    const res = await request(app).get('/api/arena/runs/run-1/diff');
    expect(res.status).toBe(200);
    expect(res.body.diff).toBe('diff --git a/test.js b/test.js');
  });

  it('DELETE /api/arena/runs/:runId cleans up arena', async () => {
    const cleanupSpy = vi.spyOn(arenaRunner, 'cleanupArena').mockReturnValue();

    const res = await request(app).delete('/api/arena/runs/run-1');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(cleanupSpy).toHaveBeenCalledWith('run-1');
  });
});
