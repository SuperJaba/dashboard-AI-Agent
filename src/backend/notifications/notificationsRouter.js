import express from 'express';
import { notificationService } from './notificationService.js';
import { telegramWebhookRouter } from './telegramWebhookRouter.js';

export const notificationsRouter = express.Router();
notificationsRouter.use(telegramWebhookRouter);

/**
 * GET /api/notifications/channels
 * Returns status of configured notification channels.
 */
notificationsRouter.get('/channels', (_req, res) => {
  try {
    const channels = notificationService.getChannelsConfig();
    res.json(channels);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/notifications/test
 * Sends a test ping notification to all configured channels.
 */
notificationsRouter.post('/test', async (req, res) => {
  try {
    const event = req.body?.event || 'ping';
    const payload = req.body?.payload || {
      source: 'Ręczny test z Dashboardu',
      timestamp: new Date().toISOString(),
    };
    await notificationService.notify(event, payload);
    res.json({ success: true, message: 'Testowe powiadomienia wysłane do skonfigurowanych kanałów.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/notifications/test-discord
 * Tests a specific Discord webhook URL directly.
 */
notificationsRouter.post('/test-discord', async (req, res) => {
  const { webhookUrl } = req.body;
  if (!webhookUrl) {
    return res.status(400).json({ error: 'Brak webhookUrl w ciele żądania.' });
  }

  try {
    await notificationService.sendDiscord(webhookUrl, 'ping', {
      source: 'Test konfiguracji Discord z Dashboardu',
    });
    res.json({ success: true, message: 'Testowe powiadomienie Discord dostarczone pomyślnie.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/notifications/test-telegram
 * Tests specific Telegram botToken and chatId directly.
 */
notificationsRouter.post('/test-telegram', async (req, res) => {
  const { botToken, chatId } = req.body;
  if (!botToken || !chatId) {
    return res.status(400).json({ error: 'Wymagane parametry botToken oraz chatId.' });
  }

  try {
    await notificationService.sendTelegram({ botToken, chatId }, 'ping', {
      source: 'Test konfiguracji Telegram z Dashboardu',
    });
    res.json({ success: true, message: 'Testowe powiadomienie Telegram wysłane pomyślnie.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
