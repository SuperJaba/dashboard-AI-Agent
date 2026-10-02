import { Router } from 'express';
import { validate } from '../schemas/validate.js';
import { alertConfigSchema, webhookSchema } from '../schemas/alertSchemas.js';
import {
  getAlertConfig,
  updateAlertConfig,
  registerAlertWebhook,
  getWebhooks,
} from './alertWatcher.js';
import { logger } from '../utils/logger.js';

export const alertsRouter = Router();

/**
 * GET /api/alerts/config
 * Zwraca aktualną konfigurację progów alertów i listę webhooków.
 */
alertsRouter.get('/config', (req, res) => {
  const config = getAlertConfig();
  const hooks = getWebhooks();
  logger.info({ userId: req.user?.id }, 'Pobrano konfigurację alertów');
  res.json({ config, webhooks: hooks });
});

/**
 * POST /api/alerts/config
 * Aktualizuje progi alertów.
 * Body: { cpuThreshold?, memThreshold?, httpErrorThreshold?, enabled? }
 */
alertsRouter.post('/config', validate(alertConfigSchema), (req, res) => {
  updateAlertConfig(req.body);
  logger.info({ userId: req.user?.id, body: req.body }, 'Zaktualizowano konfigurację alertów');
  res.json({ success: true, config: getAlertConfig() });
});

/**
 * POST /api/alerts/webhooks
 * Rejestruje nowy webhook.
 * Body: { url }
 */
alertsRouter.post('/webhooks', validate(webhookSchema), (req, res) => {
  const { url } = req.body;
  registerAlertWebhook(url);
  logger.info({ userId: req.user?.id, url }, 'Zarejestrowano webhook alertów');
  res.status(201).json({ success: true, webhooks: getWebhooks() });
});

/**
 * GET /api/alerts/webhooks
 * Zwraca listę zarejestrowanych webhooków.
 */
alertsRouter.get('/webhooks', (req, res) => {
  res.json({ webhooks: getWebhooks() });
});
