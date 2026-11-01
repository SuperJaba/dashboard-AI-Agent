import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { pipelineRouter } from './pipelineRouter.js';
import * as repo from './pipelineRepository.js';

describe('pipelineRouter', () => {
  let app;
  let mockIo;

  beforeEach(() => {
    mockIo = { emit: vi.fn() };
    app = express();
    app.use(express.json());
    app.set('io', mockIo);
    app.use('/api/pipelines', pipelineRouter);
  });

  it('GET /api/pipelines returns list of pipelines', async () => {
    const res = await request(app).get('/api/pipelines');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /api/pipelines validates name', async () => {
    const res = await request(app)
      .post('/api/pipelines')
      .send({ description: 'No name' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('POST /api/pipelines creates a new pipeline', async () => {
    const payload = {
      name: 'CI/CD Pipeline',
      description: 'Automated agent delivery',
      steps: [
        { id: 'build', name: 'Build Step', agent: 'claude', prompt: 'Run build' }
      ]
    };

    const res = await request(app)
      .post('/api/pipelines')
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.name).toBe('CI/CD Pipeline');
    expect(res.body.steps).toHaveLength(1);
  });

  it('GET /api/pipelines/:id returns single pipeline or 404', async () => {
    const notFound = await request(app).get('/api/pipelines/non-existent-id');
    expect(notFound.status).toBe(404);

    const created = await repo.createPipeline({ name: 'Fetch Pipeline', steps: [] });
    const res = await request(app).get(`/api/pipelines/${created.id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(created.id);
  });

  it('POST /api/pipelines/:id/run triggers pipeline run and returns runId', async () => {
    const created = await repo.createPipeline({
      name: 'Run Me Pipeline',
      steps: [
        { id: 'quick', name: 'Quick Step', prompt: 'echo hello' }
      ]
    });

    const res = await request(app).post(`/api/pipelines/${created.id}/run`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('runId');

    const notFound = await request(app).post('/api/pipelines/invalid-id/run');
    expect(notFound.status).toBe(404);
  });

  it('POST /api/pipelines/:id/runs/:runId/approve approves paused step', async () => {
    const res = await request(app)
      .post('/api/pipelines/p1/runs/r1/approve')
      .send({ stepId: 'step-1' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('approved');
  });

  it('DELETE /api/pipelines/:id/runs/:runId aborts pipeline run', async () => {
    const res = await request(app).delete('/api/pipelines/p1/runs/r1');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ aborted: true });
  });

  it('GET /api/pipelines/:id/runs/:runId/artifacts returns artifacts for run', async () => {
    const pipeline = await repo.createPipeline({ name: 'Artifacts API Pipeline', steps: [] });
    const run = await repo.createRun(pipeline.id);
    await repo.saveArtifact(run.id, 's1', { type: 'code', content: 'const x = 1;' });

    const res = await request(app).get(`/api/pipelines/${pipeline.id}/runs/${run.id}/artifacts`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].content).toBe('const x = 1;');
  });
});
