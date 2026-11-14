import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { telegramWebhookRouter } from './telegramWebhookRouter.js';
import * as approvalGateway from './approvalGateway.js';
import {
  createTelegramApprovalPayload,
  createTelegramPRMergePayload,
} from './adapters/telegramAdapter.js';

describe('Telegram 1-Tap PR Merge & Approval Webhook', () => {
  let app;

  beforeEach(() => {
    approvalGateway.clearAllApprovals();
    vi.restoreAllMocks();

    app = express();
    app.use(express.json());
    app.use('/api/notifications/telegram', telegramWebhookRouter);
  });

  describe('Telegram Payload Adapters', () => {
    it('creates interactive approval payload with inline keyboard buttons', () => {
      const payload = createTelegramApprovalPayload('123456', 'app-42', 'deploy:production', 'Wdrożenie na CT8');
      expect(payload.chat_id).toBe('123456');
      expect(payload.text).toContain('Wymagane Zatwierdzenie');
      expect(payload.text).toContain('deploy:production');
      expect(payload.reply_markup.inline_keyboard[0][0].callback_data).toBe('approve:app-42');
      expect(payload.reply_markup.inline_keyboard[0][1].callback_data).toBe('reject:app-42');
    });

    it('creates 1-tap PR merge payload with customized merge button', () => {
      const payload = createTelegramPRMergePayload('123456', 'app-pr-99', {
        prNumber: 99,
        prTitle: 'Add Telegram Webhook',
        repoName: 'dashboard',
        headBranch: 'feat/telegram-webhook',
        baseBranch: 'main',
      });
      expect(payload.chat_id).toBe('123456');
      expect(payload.text).toContain('1-Tap Merge');
      expect(payload.text).toContain('#99');
      expect(payload.reply_markup.inline_keyboard[0][0].text).toContain('Scal PR #99');
      expect(payload.reply_markup.inline_keyboard[0][0].callback_data).toBe('merge_pr:app-pr-99');
      expect(payload.reply_markup.inline_keyboard[0][1].callback_data).toBe('reject:app-pr-99');
    });
  });

  describe('POST /api/notifications/telegram/webhook', () => {
    it('handles approve callback_query and resolves approvalGateway', async () => {
      const approvalPromise = approvalGateway.requestApproval({
        id: 'test-app-1',
        action: 'test_action',
        description: 'Test Description',
      });

      const res = await request(app)
        .post('/api/notifications/telegram/webhook')
        .send({
          callback_query: {
            id: 'cb_1',
            from: { id: 987, first_name: 'Sebastian' },
            data: 'approve:test-app-1',
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.handled).toBe(true);
      expect(res.body.action).toBe('approve');

      const outcome = await approvalPromise;
      expect(outcome.approved).toBe(true);
      expect(outcome.metadata.approvedBy).toBe('Sebastian');
    });

    it('handles reject callback_query and marks approval as rejected', async () => {
      const approvalPromise = approvalGateway.requestApproval({
        id: 'test-app-2',
        action: 'test_action',
        description: 'Test Description',
      });

      const res = await request(app)
        .post('/api/notifications/telegram/webhook')
        .send({
          callback_query: {
            id: 'cb_2',
            from: { id: 987, first_name: 'Sebastian' },
            data: 'reject:test-app-2',
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.handled).toBe(true);
      expect(res.body.action).toBe('reject');

      const outcome = await approvalPromise;
      expect(outcome.approved).toBe(false);
      expect(outcome.reason).toBe('Odrzucono przez Telegram');
    });

    it('handles merge_pr callback_query for 1-tap PR merge', async () => {
      const approvalPromise = approvalGateway.requestApproval({
        id: 'pr-merge-101',
        action: 'merge_pr',
        description: 'Merge PR #101',
        metadata: { prNumber: 101, repoName: 'dashboard' },
      });

      const res = await request(app)
        .post('/api/notifications/telegram/webhook')
        .send({
          callback_query: {
            id: 'cb_3',
            from: { id: 987, first_name: 'Sebastian' },
            data: 'merge_pr:pr-merge-101',
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.handled).toBe(true);
      expect(res.body.action).toBe('merge_pr');
      expect(res.body.prNumber).toBe(101);

      const outcome = await approvalPromise;
      expect(outcome.approved).toBe(true);
      expect(outcome.metadata.mergedBy).toBe('Sebastian');
    });

    it('always returns HTTP 200 even for unknown or expired callback_query (Telegram requirement)', async () => {
      const res = await request(app)
        .post('/api/notifications/telegram/webhook')
        .send({
          callback_query: {
            id: 'cb_unknown',
            data: 'approve:expired-or-missing-id',
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.handled).toBe(false);
    });

    it('returns HTTP 200 for regular message updates without callback_query', async () => {
      const res = await request(app)
        .post('/api/notifications/telegram/webhook')
        .send({
          update_id: 12345,
          message: { text: '/start', chat: { id: 111 } },
        });

      expect(res.status).toBe(200);
      expect(res.body.handled).toBe(false);
    });
  });

  describe('Approval Initiation Endpoints', () => {
    it('POST /request-pr-merge queues approval and sends PR payload', async () => {
      // Mock fetch for Telegram sendMessage API
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true }),
      });

      const res = await request(app)
        .post('/api/notifications/telegram/request-pr-merge')
        .send({
          prNumber: 456,
          prTitle: 'feat: add telegram 1-tap approvals',
          repoName: 'dashboard',
          chatId: '12345',
          botToken: 'fake-bot-token',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.approvalId).toBeDefined();

      const pending = approvalGateway.getPendingApprovals();
      expect(pending).toHaveLength(1);
      expect(pending[0].metadata.prNumber).toBe(456);
      expect(global.fetch).toHaveBeenCalled();
    });

    it('GET /pending returns list of pending approvals', async () => {
      approvalGateway.requestApproval({
        id: 'app-pending-test',
        action: 'merge_pr',
        description: 'Test pending item',
      });

      const res = await request(app).get('/api/notifications/telegram/pending');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.some(a => a.id === 'app-pending-test')).toBe(true);
    });
  });
});
