import express from 'express';
import { triggerEmergencyStop } from '../agents/emergencyService.js';
import { approve, reject } from './approvalGateway.js';

export const telegramWebhookRouter = express.Router();

/**
 * Answers a Telegram callback query to clear the loading spinner in the client.
 * Non-blocking, fails gracefully if token is missing.
 */
async function answerTelegramCallback(callbackQueryId, text = '') {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !callbackQueryId) return;

  try {
    await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text,
        show_alert: false,
      }),
    });
  } catch (err) {
    console.warn('[TelegramWebhook] Could not answer callback query:', err.message);
  }
}

/**
 * POST /telegram/webhook
 * Receives updates from Telegram Bot API webhook, including 1-tap inline buttons.
 */
telegramWebhookRouter.post('/telegram/webhook', async (req, res) => {
  try {
    const { callback_query } = req.body || {};

    if (!callback_query) {
      // Standard messages or updates not requiring inline action
      return res.status(200).json({ success: true, ignored: true });
    }

    const { id: callbackId, data = '', from } = callback_query;
    const io = req.app?.get('io') || null;

    // Handle emergency stop button
    if (data === 'emergency:stop') {
      const summary = await triggerEmergencyStop({ io });
      await answerTelegramCallback(callbackId, '🚨 Wykonano Emergency Stop!');
      return res.status(200).json({
        success: true,
        action: 'emergency_stop',
        summary,
        from: from?.username || from?.id,
      });
    }

    // Handle 1-tap approvals
    if (data.startsWith('approve:')) {
      const approvalId = data.replace('approve:', '');
      approve(approvalId);
      await answerTelegramCallback(callbackId, '✅ Akcja zatwierdzona');
      if (io) {
        io.emit('approval:decided', { approvalId, approved: true, from: from?.username || from?.id });
      }
      return res.status(200).json({
        success: true,
        action: 'approve',
        approvalId,
        from: from?.username || from?.id,
      });
    }

    if (data.startsWith('reject:')) {
      const approvalId = data.replace('reject:', '');
      reject(approvalId, 'Odrzucono przez Telegram');
      await answerTelegramCallback(callbackId, '❌ Akcja odrzucona');
      if (io) {
        io.emit('approval:decided', { approvalId, approved: false, from: from?.username || from?.id });
      }
      return res.status(200).json({
        success: true,
        action: 'reject',
        approvalId,
        from: from?.username || from?.id,
      });
    }

    // Fallback for unhandled callback data
    await answerTelegramCallback(callbackId, 'Odebrano');
    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error('[TelegramWebhook] Webhook error:', err);
    // Always return 200 to Telegram so it doesn't endlessly retry failing requests
    return res.status(200).json({ success: false, error: err.message });
  }
});
