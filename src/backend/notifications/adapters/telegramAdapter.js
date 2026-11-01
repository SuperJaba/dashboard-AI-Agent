/**
 * Telegram Bot API Payload Adapter
 * Formats platform events into Telegram Markdown messages.
 */

/**
 * Formats an internal event into clean Markdown text for Telegram.
 * @param {string} event
 * @param {object} payload
 * @returns {string}
 */
export function formatTelegramMessage(event, payload = {}) {
  switch (event) {
    case 'deploy:finished': {
      const isSuccess = Boolean(payload.success);
      const icon = isSuccess ? '🚀' : '❌';
      const statusText = isSuccess ? '*Sukces* ✅' : `*Niepowodzenie* ❌ (${payload.error || 'Błąd'})`;
      return [
        `${icon} *Wdrożenie CT8.pl zakończone*`,
        ``,
        `• *Host:* \`${payload.targetHost || 'dashboard.jagger2.ct8.pl'}\``,
        `• *Status:* ${statusText}`,
        `• *Czas trwania:* \`${payload.durationSeconds ?? 0}s\``,
        `• *Data:* ${new Date().toLocaleString('pl-PL')}`,
      ].join('\n');
    }

    case 'alert:triggered': {
      return [
        `⚠️ *Alert Systemowy: Anomalia Telemetryczna*`,
        ``,
        `• *Typ:* \`${payload.type || 'Nieznany'}\``,
        `• *Komunikat:* ${payload.message || 'Wartość przekroczyła próg'}`,
        `• *Wartość bieżąca:* \`${payload.value ?? 'N/D'}\``,
        `• *Próg:* \`${payload.threshold ?? 'N/D'}\``,
        `• *Data:* ${new Date().toLocaleString('pl-PL')}`,
      ].join('\n');
    }

    case 'agent:completed': {
      return [
        `🤖 *Zadanie Agenta AI Zakończone*`,
        ``,
        `• *Agent:* \`${payload.agentName || 'Agent'}\``,
        `• *Status:* ${payload.status || 'Zakończono'}`,
        `• *Wynik:* ${payload.result || 'Brak raportu'}`,
      ].join('\n');
    }

    case 'approval:requested': {
      return [
        `⚠️ *Wymagane Potwierdzenie Akcji (1-Tap Approval)*`,
        ``,
        `• *Akcja:* \`${payload.action || 'Akcja'}\``,
        `• *Szczegóły:* ${payload.description || 'Brak opisu'}`,
        `• *Data:* ${new Date().toLocaleString('pl-PL')}`,
      ].join('\n');
    }

    case 'ping':
    default: {
      return [
        `🔔 *Test Powiadomień Telegram — Dashboard AI Agent*`,
        ``,
        `Połączenie z botem Telegram działa prawidłowo. Aplikacja pomyślnie wysyła powiadomienia na ten czat.`,
        `• *Data:* ${new Date().toLocaleString('pl-PL')}`,
      ].join('\n');
    }
  }
}

/**
 * Creates Telegram sendMessage request body.
 * @param {string|number} chatId
 * @param {string} event
 * @param {object} payload
 * @returns {object}
 */
export function createTelegramPayload(chatId, event, payload = {}) {
  return {
    chat_id: chatId,
    text: formatTelegramMessage(event, payload),
    parse_mode: 'Markdown',
  };
}

/**
 * Creates Telegram sendMessage request body with interactive 1-tap inline buttons.
 * @param {string|number} chatId
 * @param {string} approvalId
 * @param {string} action
 * @param {string} description
 * @returns {object}
 */
export function createTelegramApprovalPayload(chatId, approvalId, action, description) {
  return {
    chat_id: chatId,
    text: formatTelegramMessage('approval:requested', { action, description }),
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✅ Zatwierdź', callback_data: `approve:${approvalId}` },
          { text: '❌ Odrzuć', callback_data: `reject:${approvalId}` },
        ],
      ],
    },
  };
}
