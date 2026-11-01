import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { timemachineRouter } from './timemachineRouter.js';
import * as snapshotService from './snapshotService.js';
import { safeQuery } from '../db.js';

describe('timemachineRouter', () => {
  let app;

  beforeEach(async () => {
    app = express();
    app.use(express.json());
    app.use('/api/timemachine', timemachineRouter);

    try {
      await safeQuery('DELETE FROM snapshot_events');
      await safeQuery('DELETE FROM snapshot_sessions');
    } catch {}
  });

  it('GET /api/timemachine/sessions returns list of snapshot sessions', async () => {
    await safeQuery(
      'INSERT INTO snapshot_sessions (id, agent_name, started_at) VALUES (?, ?, ?)',
      ['sess-1', 'claude-architect', new Date().toISOString()]
    );

    const res = await request(app).get('/api/timemachine/sessions');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some(s => s.id === 'sess-1')).toBe(true);
  });

  it('GET /api/timemachine/sessions/:id/events returns events for session', async () => {
    const sessionId = await snapshotService.startSession('test-agent', null, { watch: false });
    await snapshotService.recordBashCmd(sessionId, 'npm test', 0);

    const res = await request(app).get(`/api/timemachine/sessions/${sessionId}/events`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].cmdline).toBe('npm test');
  });

  it('POST /api/timemachine/sessions/:id/rollback rolls back file changes to sequence or timestamp', async () => {
    const sessionId = await snapshotService.startSession('test-agent', null, { watch: false });
    await snapshotService.recordBashCmd(sessionId, 'echo 1', 0);

    const res = await request(app)
      .post(`/api/timemachine/sessions/${sessionId}/rollback`)
      .send({ seq: 0 });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(Array.isArray(res.body.revertedFiles)).toBe(true);
  });

  it('POST /api/timemachine/sessions/:id/rollback returns 400 when neither seq nor timestamp provided', async () => {
    const res = await request(app)
      .post('/api/timemachine/sessions/sess-test/rollback')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });
});
