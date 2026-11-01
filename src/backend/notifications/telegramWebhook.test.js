import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createTelegramApprovalPayload } from './adapters/telegramAdapter.js';
import { telegramWebhookRouter } from './telegramWebhookRouter.js';
import { requestApproval, getPendingApprovals } from './approvalGateway.js';

describe('Telegram Webhook and Interactive Approvals', () => {
  it('generates telegram payload with inline keyboard buttons for 1-tap approval', () => {
    const payload = createTelegramApprovalPayload(
      '123456789',
      'approval-42',
      'Wdrożenie na CT8.pl',
      'Wdrażanie wersji produkcyjnej do dashboard.jagger2.ct8.pl'
    );

    expect(payload.chat_id).toBe('123456789');
    expect(payload.text).toContain('Wdrożenie na CT8.pl');
    expect(payload.reply_markup).toBeDefined();
    expect(payload.reply_markup.inline_keyboard).toEqual([
      [
        { text: '✅ Zatwierdź', callback_data: 'approve:approval-42' },
        { text: '❌ Odrzuć', callback_data: 'reject:approval-42' },
      ],
    ]);
  });

  it('handles approve callback query via webhook endpoint', async () => {
    const promise = requestApproval({ id: 'approval-42', action: 'deploy', description: 'Deploy test' });

    const app = express();
    app.use(express.json());
    app.use('/api/notifications', telegramWebhookRouter);

    const res = await request(app)
      .post('/api/notifications/telegram/webhook')
      .send({
        callback_query: {
          id: 'cb-123',
          data: 'approve:approval-42',
          from: { id: 98765, username: 'seba' },
        },
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: true,
        action: 'approve',
        approvalId: 'approval-42',
      })
    );

    const outcome = await promise;
    expect(outcome).toEqual({ approved: true });
  });

  it('handles reject callback query via webhook endpoint', async () => {
    const promise = requestApproval({ id: 'approval-99', action: 'drop_db', description: 'Drop DB test' });

    const app = express();
    app.use(express.json());
    app.use('/api/notifications', telegramWebhookRouter);

    const res = await request(app)
      .post('/api/notifications/telegram/webhook')
      .send({
        callback_query: {
          id: 'cb-124',
          data: 'reject:approval-99',
          from: { id: 98765, username: 'seba' },
        },
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: true,
        action: 'reject',
        approvalId: 'approval-99',
      })
    );

    const outcome = await promise;
    expect(outcome.approved).toBe(false);
  });

  it('handles emergency:stop callback query directly from mobile Telegram button', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/notifications', telegramWebhookRouter);

    const res = await request(app)
      .post('/api/notifications/telegram/webhook')
      .send({
        callback_query: {
          id: 'cb-125',
          data: 'emergency:stop',
          from: { id: 98765, username: 'seba' },
        },
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: true,
        action: 'emergency_stop',
      })
    );
  });
});
