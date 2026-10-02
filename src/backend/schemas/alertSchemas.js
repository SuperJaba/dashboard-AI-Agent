import { z } from 'zod';

/**
 * T7.4 — Schemat konfiguracji progów alertów.
 */
export const alertConfigSchema = z.object({
  cpuThreshold: z
    .number()
    .min(1)
    .max(100)
    .optional()
    .describe('Próg CPU w procentach (domyślnie 90)'),
  memThreshold: z
    .number()
    .min(1)
    .max(100)
    .optional()
    .describe('Próg pamięci w procentach (domyślnie 85)'),
  httpErrorThreshold: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe('Liczba błędów HTTP 5xx w ciągu 60s (domyślnie 3)'),
  enabled: z
    .boolean()
    .optional()
    .describe('Włącz/wyłącz watcher alertów'),
});

/**
 * Schemat rejestracji webhooka.
 */
export const webhookSchema = z.object({
  url: z.string().url('Nieprawidłowy adres URL webhooka'),
});
