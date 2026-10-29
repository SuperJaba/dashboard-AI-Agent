/**
 * Discord Webhook Payload Adapter
 * Formats platform events into rich Discord embeds.
 */

const COLORS = {
  SUCCESS: 0x10B981, // Emerald
  ERROR: 0xEF4444,   // Red
  WARNING: 0xF59E0B, // Amber
  INFO: 0x6366F1,    // Indigo
};

/**
 * Transforms an internal event into a Discord webhook payload with embeds.
 * @param {string} event - Event name (e.g. 'deploy:finished', 'alert:triggered', 'ping')
 * @param {object} payload - Event payload data
 * @returns {object} Discord-compatible JSON payload
 */
export function formatDiscordPayload(event, payload = {}) {
  const timestamp = new Date().toISOString();

  switch (event) {
    case 'deploy:finished': {
      const isSuccess = Boolean(payload.success);
      return {
        username: 'Dashboard Deployer',
        avatar_url: 'https://raw.githubusercontent.com/feathericons/feather/master/icons/rocket.svg',
        content: isSuccess
          ? '🚀 **Wdrożenie na serwer produkcyjny zakończone sukcesem!**'
          : '❌ **Wdrożenie na serwer produkcyjny zakończyło się błędem!**',
        embeds: [
          {
            title: isSuccess ? 'Wdrożenie CT8.pl: Sukces' : 'Wdrożenie CT8.pl: Błąd',
            color: isSuccess ? COLORS.SUCCESS : COLORS.ERROR,
            fields: [
              { name: 'Host docelowy', value: `\`${payload.targetHost || 'dashboard.jagger2.ct8.pl'}\``, inline: true },
              { name: 'Czas trwania', value: `${payload.durationSeconds ?? 0}s`, inline: true },
              { name: 'Status', value: isSuccess ? '✅ Sukces' : `❌ ${payload.error || 'Nieznany błąd'}`, inline: false },
            ],
            footer: { text: 'Dashboard AI Agent • CT8 Delivery' },
            timestamp,
          },
        ],
      };
    }

    case 'alert:triggered': {
      return {
        username: 'Dashboard Monitor',
        avatar_url: 'https://raw.githubusercontent.com/feathericons/feather/master/icons/alert-triangle.svg',
        content: '⚠️ **Wykryto anomalię telemetryczną serwera!**',
        embeds: [
          {
            title: `Alert: ${payload.type || 'Anomalia systemowa'}`,
            description: payload.message || 'Wartość metryki przekroczyła skonfigurowany próg.',
            color: COLORS.WARNING,
            fields: [
              { name: 'Wartość bieżąca', value: `${payload.value ?? 'N/D'}`, inline: true },
              { name: 'Zdefiniowany próg', value: `${payload.threshold ?? 'N/D'}`, inline: true },
            ],
            footer: { text: 'Dashboard AI Agent • Alert Watcher' },
            timestamp,
          },
        ],
      };
    }

    case 'agent:completed': {
      return {
        username: 'Dashboard AI Agent',
        avatar_url: 'https://raw.githubusercontent.com/feathericons/feather/master/icons/cpu.svg',
        content: '🤖 **Zadanie autonomicznego Agenta zostało zakończone.**',
        embeds: [
          {
            title: `Agent: ${payload.agentName || 'AI Agent'}`,
            color: COLORS.INFO,
            fields: [
              { name: 'Status', value: payload.status || 'Zakończono', inline: true },
              { name: 'Wynik', value: payload.result || 'Brak dodatkowego raportu.', inline: false },
            ],
            footer: { text: 'Dashboard AI Agent • Task Lifecycle' },
            timestamp,
          },
        ],
      };
    }

    case 'ping':
    default: {
      return {
        username: 'Dashboard Notifications',
        avatar_url: 'https://raw.githubusercontent.com/feathericons/feather/master/icons/bell.svg',
        content: '🔔 **Testowe powiadomienie z Dashboardu.**',
        embeds: [
          {
            title: 'Test połączenia webhook / kanału powiadomień',
            description: 'Kanał Discord został poprawnie skonfigurowany i odbiera powiadomienia z aplikacji.',
            color: COLORS.INFO,
            fields: [
              { name: 'Zdarzenie', value: `\`${event}\``, inline: true },
              { name: 'Źródło', value: payload.source || 'Dashboard Webhook Test', inline: true },
            ],
            footer: { text: 'Dashboard AI Agent' },
            timestamp,
          },
        ],
      };
    }
  }
}
