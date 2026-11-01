import express from 'express';
import {
  getPendingApprovals,
  requestApproval,
  approve,
  reject
} from './approvalGateway.js';

export const approvalsRouter = express.Router();

/**
 * GET /api/approvals/pending
 */
approvalsRouter.get('/pending', (req, res) => {
  const approvals = getPendingApprovals();
  res.json({ approvals });
});

/**
 * POST /api/approvals/request
 */
approvalsRouter.post('/request', (req, res) => {
  const { id = `app-${Date.now()}`, action, description, timeoutMs, metadata } = req.body;
  if (!action || !description) {
    return res.status(400).json({ error: 'action and description are required' });
  }

  // Register in gateway (do not await full lifecycle here; returns immediately to caller)
  requestApproval({ id, action, description, timeoutMs, metadata });

  const io = req.app?.get('io');
  if (io) {
    io.emit('approval:requested', { id, action, description, metadata });
  }

  res.status(201).json({ success: true, id });
});

/**
 * POST /api/approvals/:id/approve
 */
approvalsRouter.post('/:id/approve', (req, res) => {
  const { id } = req.params;
  const ok = approve(id);
  if (!ok) {
    return res.status(404).json({ error: 'Approval not found or already processed' });
  }

  const io = req.app?.get('io');
  if (io) {
    io.emit('approval:decided', { approvalId: id, approved: true });
  }

  res.json({ success: true, id, approved: true });
});

/**
 * POST /api/approvals/:id/reject
 */
approvalsRouter.post('/:id/reject', (req, res) => {
  const { id } = req.params;
  const { reason = 'Rejected by user' } = req.body || {};
  const ok = reject(id, reason);
  if (!ok) {
    return res.status(404).json({ error: 'Approval not found or already processed' });
  }

  const io = req.app?.get('io');
  if (io) {
    io.emit('approval:decided', { approvalId: id, approved: false, reason });
  }

  res.json({ success: true, id, approved: false, reason });
});
