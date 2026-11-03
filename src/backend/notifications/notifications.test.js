import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { formatDiscordPayload } from './adapters/discordAdapter.js';
import { formatTelegramMessage, createTelegramPayload } from './adapters/telegramAdapter.js';
import { notificationService } from './notificationService.js';
import { notificationsRouter } from './notificationsRouter.js';

describe('DiscordAdapter', () => {
  it('formats deploy:finished success event correctly', () => {
    const payload = { success: true, durationSeconds: 52, targetHost: 'dashboard.jagger2.ct8.pl' };
    const discord = formatDiscordPayload('deploy:finished', payload);

    expect(discord.content).toContain('zakończone sukcesem');
    expect(discord.embeds).toHaveLength(1);
    expect(discord.embeds[0].color).toBe(0x10B981);
    expect(discord.embeds[0].fields.some((f) => f.name === 'Czas trwania')).toBe(true);
  });

  it('formats deploy:finished failure event with error color', () => {
    const payload = { success: false, error: 'SSH connection timeout', durationSeconds: 12 };
    const discord = formatDiscordPayload('deploy:finished', payload);

    expect(discord.content).toContain('błędem');
    expect(discord.embeds[0].color).toBe(0xEF4444);
    expect(discord.embeds[0].fields.some((f) => f.value.includes('SSH connection timeout'))).toBe(true);
  });

  it('formats alert:triggered event', () => {
    const payload = { type: 'CPU Alert', message: 'CPU usage > 90%', value: 92, threshold: 90 };
    const discord = formatDiscordPayload('alert:triggered', payload);

    expect(discord.content).toContain('anomalię');
    expect(discord.embeds[0].color).toBe(0xF59E0B);
  });

  it('formats ping event', () => {
    const discord = formatDiscordPayload('ping', { source: 'unit-test' });
    expect(discord.embeds[0].title).toContain('Test połączenia');
  });
});

describe('TelegramAdapter', () => {
  it('formats deploy:finished event into Telegram Markdown', () => {
    const message = formatTelegramMessage('deploy:finished', {
      success: true,
      targetHost: 'dashboard.jagger2.ct8.pl',
      durationSeconds: 40,
    });

    expect(message).toContain('Wdrożenie CT8.pl zakończone');
    expect(message).toContain('dashboard.jagger2.ct8.pl');
    expect(message).toContain('Sukces');
  });

  it('creates valid telegram request payload', () => {
    const payload = createTelegramPayload('123456789', 'ping', {});
    expect(payload.chat_id).toBe('123456789');
    expect(payload.parse_mode).toBe('Markdown');
    expect(payload.text).toContain('Test Powiadomień');
  });
});

describe('NotificationService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns configured channel status', () => {
    process.env.DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/123/tokenXYZ';
    process.env.TELEGRAM_BOT_TOKEN = 'bot123456';
    process.env.TELEGRAM_CHAT_ID = '987654';

    const config = notificationService.getChannelsConfig();
    expect(config.discord.configured).toBe(true);
    expect(config.discord.url).toContain('discord.com');
    expect(config.discord.url).toContain('********');
    expect(config.telegram.configured).toBe(true);
    expect(config.telegram.chatId).toBe('987654');

    delete process.env.DISCORD_WEBHOOK_URL;
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
  });

  it('sends Discord notification when URL is provided', async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });

    try {
      const res = await notificationService.sendDiscord('https://discord.com/api/webhooks/test', 'ping', {});
      expect(res.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://discord.com/api/webhooks/test',
        expect.objectContaining({ method: 'POST' })
      );
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('NotificationsRouter API', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/notifications', notificationsRouter);

  it('GET /api/notifications/channels returns channels configuration', async () => {
    const res = await request(app).get('/api/notifications/channels');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('discord');
    expect(res.body).toHaveProperty('telegram');
  });

  it('POST /api/notifications/test-discord rejects missing webhookUrl', async () => {
    const res = await request(app).post('/api/notifications/test-discord').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Brak webhookUrl');
  });

  it('POST /api/notifications/test-telegram rejects missing parameters', async () => {
    const res = await request(app).post('/api/notifications/test-telegram').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Wymagane parametry');
  });
});
