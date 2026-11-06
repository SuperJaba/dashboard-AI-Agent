import express from 'express';
import crypto from 'crypto';
import { logger } from '../utils/logger.js';
import * as approvalGateway from './approvalGateway.js';
import {
  createTelegramApprovalPayload,
  createTelegramPRMergePayload,
} from './adapters/telegramAdapter.js';
import { mergePR } from '../git/gitService.js';

export const telegramWebhookRouter = express.Router();

/**
 * Sends callback query answer back to Telegram API so the mobile UI stops loading.
 * @param {string} callbackQueryId
 * @param {string} text
 * @param {string} [botToken]
 */
async function answerTelegramCallback(callbackQueryId, text, botToken) {
  const token = botToken || process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !callbackQueryId) return;

  try {
    await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text,
        show_alert: true,
      }),
    });
  } catch (err) {
    logger.warn({ err: err.message }, 'Failed to answer Telegram callback query');
  }
}

/**
 * Updates original Telegram message to reflect approval status.
 * @param {string|number} chatId
 * @param {number} messageId
 * @param {string} text
 * @param {string} [botToken]
 */
async function updateTelegramMessage(chatId, messageId, text, botToken) {
  const token = botToken || process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId || !messageId) return;

  try {
    await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: 'Markdown',
      }),
    });
  } catch (err) {
    logger.warn({ err: err.message }, 'Failed to edit Telegram message text');
  }
}

/**
 * POST /webhook
 * Telegram Webhook receiver endpoint.
 * Always returns HTTP 200 to prevent Telegram from retrying.
 */
telegramWebhookRouter.post('/webhook', async (req, res) => {
  const { callback_query, message } = req.body || {};

  if (!callback_query) {
    // Regular text message or bot command
    if (message?.text === '/pending') {
      const pending = approvalGateway.getPendingApprovals();
      return res.status(200).json({ handled: false, pendingCount: pending.length });
    }
    return res.status(200).json({ handled: false, message: 'No callback_query in payload' });
  }

  const { id: callbackQueryId, data, from, message: tgMessage } = callback_query;
  const callerName = from?.first_name || from?.username || 'Telegram User';

  if (!data || typeof data !== 'string' || !data.includes(':')) {
    await answerTelegramCallback(callbackQueryId, '⚠️ Nieznany format przycisku.');
    return res.status(200).json({ handled: false, error: 'Invalid callback data format' });
  }

  const [action, approvalId] = data.split(':');
  const existingApproval = approvalGateway.getApproval(approvalId);

  if (!existingApproval) {
    await answerTelegramCallback(callbackQueryId, '⚠️ Żądanie wygasło lub zostało już przetworzone.');
    return res.status(200).json({ handled: false, error: 'Approval not found or already completed' });
  }

  if (action === 'merge_pr') {
    const prNumber = existingApproval.metadata?.prNumber;
    const directory = existingApproval.metadata?.directory || process.cwd();

    logger.info({ approvalId, prNumber, callerName }, '1-Tap PR Merge initiated via Telegram Webhook');

    // Resolve the approval gateway
    approvalGateway.approve(approvalId, {
      mergedBy: callerName,
      mergedAt: new Date().toISOString(),
      source: 'telegram_inline_button',
    });

    let mergeResult = null;
    if (prNumber) {
      try {
        mergeResult = await mergePR({ directory, prNumber });
      } catch (err) {
        mergeResult = { success: false, error: err.message };
      }
    }

    const isSuccess = mergeResult ? mergeResult.success : true;
    const alertText = isSuccess
      ? `✅ PR #${prNumber || ''} został zatwierdzony i scalony przez ${callerName}!`
      : `⚠️ PR #${prNumber} zatwierdzony, ale błąd scalania: ${mergeResult?.error || 'błąd'}`;

    await answerTelegramCallback(callbackQueryId, alertText);

    if (tgMessage?.chat?.id && tgMessage?.message_id) {
      await updateTelegramMessage(
        tgMessage.chat.id,
        tgMessage.message_id,
        `✅ *PR #${prNumber || ''} — Scalony (1-Tap Merge)*\n\n` +
        `• *Zatwierdził:* ${callerName}\n` +
        `• *Data:* ${new Date().toLocaleString('pl-PL')}\n` +
        `• *Status:* ${isSuccess ? 'Zmergowany pomyślnie' : 'Błąd scalenia: ' + mergeResult?.error}`
      );
    }

    return res.status(200).json({
      handled: true,
      action: 'merge_pr',
      approvalId,
      prNumber,
      mergeResult,
    });
  }

  if (action === 'approve') {
    approvalGateway.approve(approvalId, {
      approvedBy: callerName,
      approvedAt: new Date().toISOString(),
      source: 'telegram_inline_button',
    });

    await answerTelegramCallback(callbackQueryId, `✅ Zatwierdzono akcję przez ${callerName}!`);

    if (tgMessage?.chat?.id && tgMessage?.message_id) {
      await updateTelegramMessage(
        tgMessage.chat.id,
        tgMessage.message_id,
        `✅ *Zatwierdzono*\n\n` +
        `• *Akcja:* \`${existingApproval.action}\`\n` +
        `• *Zatwierdził:* ${callerName}\n` +
        `• *Data:* ${new Date().toLocaleString('pl-PL')}`
      );
    }

    return res.status(200).json({ handled: true, action: 'approve', approvalId });
  }

  if (action === 'reject') {
    approvalGateway.reject(approvalId, 'Odrzucono przez Telegram');

    await answerTelegramCallback(callbackQueryId, `❌ Odrzucono akcję przez ${callerName}.`);

    if (tgMessage?.chat?.id && tgMessage?.message_id) {
      await updateTelegramMessage(
        tgMessage.chat.id,
        tgMessage.message_id,
        `❌ *Odrzucono*\n\n` +
        `• *Akcja:* \`${existingApproval.action}\`\n` +
        `• *Odrzucił:* ${callerName}\n` +
        `• *Data:* ${new Date().toLocaleString('pl-PL')}`
      );
    }

    return res.status(200).json({ handled: true, action: 'reject', approvalId });
  }

  await answerTelegramCallback(callbackQueryId, '⚠️ Nieznana akcja.');
  return res.status(200).json({ handled: false, error: 'Unknown action' });
});

/**
 * POST /request-pr-merge
 * Emits a 1-Tap PR Merge notification to Telegram with inline buttons and registers with approvalGateway.
 */
telegramWebhookRouter.post('/request-pr-merge', async (req, res) => {
  const {
    id = `pr-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
    prNumber,
    prTitle,
    repoName,
    headBranch,
    baseBranch,
    directory,
    chatId = process.env.TELEGRAM_CHAT_ID,
    botToken = process.env.TELEGRAM_BOT_TOKEN,
    timeoutMs = 30 * 60 * 1000,
  } = req.body;

  if (!prNumber) {
    return res.status(400).json({ error: 'prNumber jest wymagany' });
  }

  const approvalPromise = approvalGateway.requestApproval({
    id,
    action: 'merge_pr',
    description: `Merge PR #${prNumber}: ${prTitle || ''}`,
    metadata: {
      prNumber,
      prTitle,
      repoName,
      headBranch,
      baseBranch,
      directory,
    },
    timeoutMs,
  });

  if (chatId && botToken) {
    const payload = createTelegramPRMergePayload(chatId, id, {
      prNumber,
      prTitle,
      repoName,
      headBranch,
      baseBranch,
    });

    try {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      logger.error({ err: err.message }, 'Failed to send PR merge notification to Telegram');
    }
  }

  res.json({
    success: true,
    approvalId: id,
    status: 'pending',
    message: `Oczekiwanie na zatwierdzenie scalenia PR #${prNumber} (1-Tap Merge w Telegramie)...`,
  });

  // Keep promise alive in background
  approvalPromise.catch(() => {});
});

/**
 * POST /request-approval
 * Generic human approval request with Telegram inline buttons.
 */
telegramWebhookRouter.post('/request-approval', async (req, res) => {
  const {
    id = `app-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
    action,
    description,
    metadata = {},
    chatId = process.env.TELEGRAM_CHAT_ID,
    botToken = process.env.TELEGRAM_BOT_TOKEN,
    timeoutMs = 30 * 60 * 1000,
  } = req.body;

  if (!action || !description) {
    return res.status(400).json({ error: 'action i description są wymagane' });
  }

  const approvalPromise = approvalGateway.requestApproval({
    id,
    action,
    description,
    metadata,
    timeoutMs,
  });

  if (chatId && botToken) {
    const payload = createTelegramApprovalPayload(chatId, id, action, description);
    try {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      logger.error({ err: err.message }, 'Failed to send approval notification to Telegram');
    }
  }

  res.json({
    success: true,
    approvalId: id,
    status: 'pending',
    message: `Zarejestrowano żądanie zatwierdzenia '${action}'.`,
  });

  approvalPromise.catch(() => {});
});

/**
 * GET /pending
 * Returns all active pending approvals.
 */
telegramWebhookRouter.get('/pending', (_req, res) => {
  res.json(approvalGateway.getPendingApprovals());
});

/**
 * POST /approve/:id
 * Direct approval (e.g. from web UI).
 */
telegramWebhookRouter.post('/approve/:id', (req, res) => {
  const ok = approvalGateway.approve(req.params.id, { source: 'web_dashboard' });
  if (!ok) return res.status(404).json({ error: 'Approval not found or already completed' });
  res.json({ success: true, approved: true });
});

/**
 * POST /reject/:id
 * Direct rejection (e.g. from web UI).
 */
telegramWebhookRouter.post('/reject/:id', (req, res) => {
  const reason = req.body?.reason || 'Rejected from dashboard';
  const ok = approvalGateway.reject(req.params.id, reason);
  if (!ok) return res.status(404).json({ error: 'Approval not found or already completed' });
  res.json({ success: true, approved: false });
});
