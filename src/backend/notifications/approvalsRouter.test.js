import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { approvalsRouter } from './approvalsRouter.js';
import { clearPendingApprovals, requestApproval } from './approvalGateway.js';

describe('approvalsRouter', () => {
  let app;

  beforeEach(() => {
    clearPendingApprovals();
    app = express();
    app.use(express.json());
    app.use('/api/approvals', approvalsRouter);
  });

  it('GET /api/approvals/pending returns current list of pending approvals', async () => {
    // Start pending approval in background
    requestApproval({ id: 'app-test-1', action: 'deploy', description: 'Deploy to CT8' });

    const res = await request(app).get('/api/approvals/pending');
    expect(res.status).toBe(200);
    expect(res.body.approvals).toHaveLength(1);
    expect(res.body.approvals[0].id).toBe('app-test-1');
    expect(res.body.approvals[0].action).toBe('deploy');
  });

  it('POST /api/approvals/request creates a new pending approval', async () => {
    const res = await request(app)
      .post('/api/approvals/request')
      .send({ id: 'app-test-2', action: 'restart_daemon', description: 'Restart daemon' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.id).toBe('app-test-2');
  });

  it('POST /api/approvals/:id/approve approves pending request', async () => {
    const promise = requestApproval({ id: 'app-test-3', action: 'migrate_db', description: 'Run migration' });

    const res = await request(app).post('/api/approvals/app-test-3/approve');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const outcome = await promise;
    expect(outcome).toEqual({ approved: true });
  });

  it('POST /api/approvals/:id/reject rejects pending request', async () => {
    const promise = requestApproval({ id: 'app-test-4', action: 'purge_cache', description: 'Purge cache' });

    const res = await request(app)
      .post('/api/approvals/app-test-4/reject')
      .send({ reason: 'Not now' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const outcome = await promise;
    expect(outcome.approved).toBe(false);
    expect(outcome.reason).toBe('Not now');
  });

  it('returns 404 when approving or rejecting non-existent approval', async () => {
    const resApprove = await request(app).post('/api/approvals/unknown/approve');
    expect(resApprove.status).toBe(404);

    const resReject = await request(app).post('/api/approvals/unknown/reject');
    expect(resReject.status).toBe(404);
  });
});
