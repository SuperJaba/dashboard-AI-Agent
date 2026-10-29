import { logger } from '../utils/logger.js';
import { formatDiscordPayload } from './adapters/discordAdapter.js';
import { createTelegramPayload } from './adapters/telegramAdapter.js';
import { dispatchWebhook } from '../webhooks/webhookDispatcher.js';

class NotificationService {
  constructor() {
    this.timeoutMs = 6000;
  }

  getChannelsConfig() {
    return {
      discord: {
        configured: Boolean(process.env.DISCORD_WEBHOOK_URL),
        url: process.env.DISCORD_WEBHOOK_URL ? this.maskUrl(process.env.DISCORD_WEBHOOK_URL) : null,
      },
      telegram: {
        configured: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
        chatId: process.env.TELEGRAM_CHAT_ID || null,
      },
    };
  }

  maskUrl(url) {
    try {
      const u = new URL(url);
      const parts = u.pathname.split('/');
      if (parts.length > 2) {
        parts[parts.length - 1] = '********';
      }
      return `${u.origin}${parts.join('/')}`;
    } catch {
      return '***configured***';
    }
  }

  async sendDiscord(webhookUrl, event, payload = {}) {
    if (!webhookUrl) throw new Error('Brak adresu URL webhooka Discord.');
    const discordBody = formatDiscordPayload(event, payload);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(discordBody),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Discord API zwróciło status ${res.status}: ${text}`);
      }

      logger.info({ event }, 'Discord notification sent successfully');
      return { success: true };
    } finally {
      clearTimeout(timer);
    }
  }

  async sendTelegram({ botToken, chatId }, event, payload = {}) {
    const token = botToken || process.env.TELEGRAM_BOT_TOKEN;
    const chat = chatId || process.env.TELEGRAM_CHAT_ID;

    if (!token || !chat) {
      throw new Error('Brak tokenu bota lub Chat ID dla Telegrama.');
    }

    const apiUrl = `https://api.telegram.org/bot${token}/sendMessage`;
    const telegramBody = createTelegramPayload(chat, event, payload);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(telegramBody),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Telegram API zwróciło status ${res.status}: ${text}`);
      }

      logger.info({ event, chat }, 'Telegram notification sent successfully');
      return { success: true };
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Broadcasts an event across all configured notification channels and webhooks.
   * Fire-and-forget; does not block caller.
   * @param {string} event
   * @param {object} payload
   */
  notify(event, payload = {}) {
    const promises = [];

    // 1. Dedykowany Discord Webhook ze zmiennych środowiskowych
    const discordUrl = process.env.DISCORD_WEBHOOK_URL;
    if (discordUrl) {
      promises.push(
        this.sendDiscord(discordUrl, event, payload).catch((err) => {
          logger.error({ err: err.message, event }, 'Failed to deliver Discord notification');
        })
      );
    }

    // 2. Dedykowany Telegram Bot ze zmiennych środowiskowych
    const tgToken = process.env.TELEGRAM_BOT_TOKEN;
    const tgChat = process.env.TELEGRAM_CHAT_ID;
    if (tgToken && tgChat) {
      promises.push(
        this.sendTelegram({ botToken: tgToken, chatId: tgChat }, event, payload).catch((err) => {
          logger.error({ err: err.message, event }, 'Failed to deliver Telegram notification');
        })
      );
    }

    // 3. Zarejestrowane subskrypcje webhooków z bazy danych / pamięci
    try {
      dispatchWebhook(event, payload);
    } catch (err) {
      logger.error({ err: err.message, event }, 'Error dispatching to standard webhooks');
    }

    return Promise.allSettled(promises);
  }
}

export const notificationService = new NotificationService();
