import { z } from 'zod';

export const VALID_EVENTS = ['agent:completed', 'alert:triggered', 'deploy:finished', 'ping'];

export const createWebhookSchema = z.object({
  url: z.string().url('Nieprawidłowy adres URL'),
  events: z
    .array(z.enum(['agent:completed', 'alert:triggered', 'deploy:finished', 'ping']))
    .min(1, 'Wybierz co najmniej jedno zdarzenie'),
  secret: z.string().max(256).optional().default(''),
  active: z.boolean().optional().default(true),
});

export const updateWebhookSchema = z.object({
  url: z.string().url('Nieprawidłowy adres URL').optional(),
  events: z
    .array(z.enum(['agent:completed', 'alert:triggered', 'deploy:finished', 'ping']))
    .min(1, 'Wybierz co najmniej jedno zdarzenie')
    .optional(),
  secret: z.string().max(256).optional(),
  active: z.boolean().optional(),
});
