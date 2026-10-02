import express from 'express';
import * as repo from './webhookRepository.js';
import { dispatchWebhook } from './webhookDispatcher.js';
import { createWebhookSchema, updateWebhookSchema } from '../schemas/webhookSchemas.js';
import { validate } from '../schemas/validate.js';

export const webhooksRouter = express.Router();

// GET /api/webhooks — list all webhooks
webhooksRouter.get('/', (_req, res) => {
  res.json(repo.findAll());
});

// POST /api/webhooks — create webhook
webhooksRouter.post('/', validate(createWebhookSchema), (req, res) => {
  const webhook = repo.create(req.body);
  res.status(201).json(webhook);
});

// PUT /api/webhooks/:id — update webhook
webhooksRouter.put('/:id', validate(updateWebhookSchema), (req, res) => {
  const updated = repo.update(req.params.id, req.body);
  if (!updated) {
    return res.status(404).json({ error: 'Webhook nie istnieje' });
  }
  res.json(updated);
});

// DELETE /api/webhooks/:id — remove webhook
webhooksRouter.delete('/:id', (req, res) => {
  const deleted = repo.remove(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: 'Webhook nie istnieje' });
  }
  res.json({ success: true });
});

// POST /api/webhooks/:id/ping — send ping test event
webhooksRouter.post('/:id/ping', (req, res) => {
  const webhook = repo.findById(req.params.id);
  if (!webhook) {
    return res.status(404).json({ error: 'Webhook nie istnieje' });
  }
  dispatchWebhook('ping', { source: 'manual-ping', webhookId: webhook.id });
  res.json({ success: true, message: 'Ping wysłany' });
});
