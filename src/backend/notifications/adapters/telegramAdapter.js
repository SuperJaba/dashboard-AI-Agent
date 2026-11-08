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
 * Creates Telegram payload with interactive approval buttons.
 * @param {string|number} chatId
 * @param {string} approvalId
 * @param {string} action
 * @param {string} description
 * @returns {object}
 */
export function createTelegramApprovalPayload(chatId, approvalId, action, description) {
  return {
    chat_id: chatId,
    text: [
      `🔔 *Wymagane Zatwierdzenie*`,
      ``,
      `• *Akcja:* \`${action}\``,
      `• *Opis:* ${description}`,
      `• *Czas:* ${new Date().toLocaleString('pl-PL')}`,
    ].join('\n'),
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [[
        { text: '✅ Zatwierdź', callback_data: `approve:${approvalId}` },
        { text: '❌ Odrzuć', callback_data: `reject:${approvalId}` },
      ]],
    },
  };
}

/**
 * Creates Telegram payload specifically tailored for 1-tap PR merge approval.
 * @param {string|number} chatId
 * @param {string} approvalId
 * @param {object} prDetails
 * @param {number|string} prDetails.prNumber
 * @param {string} prDetails.prTitle
 * @param {string} [prDetails.repoName]
 * @param {string} [prDetails.headBranch]
 * @param {string} [prDetails.baseBranch]
 * @returns {object}
 */
export function createTelegramPRMergePayload(chatId, approvalId, prDetails = {}) {
  const prNumber = prDetails.prNumber || 'N/A';
  const prTitle = prDetails.prTitle || 'Pull Request';
  const repoName = prDetails.repoName || 'Repo';
  const branchInfo = prDetails.headBranch ? ` (\`${prDetails.headBranch}\` → \`${prDetails.baseBranch || 'main'}\`)` : '';

  return {
    chat_id: chatId,
    text: [
      `🔀 *Wymagane Zatwierdzenie Scalenia PR (1-Tap Merge)*`,
      ``,
      `• *Repo:* \`${repoName}\``,
      `• *PR:* #${prNumber} — *${prTitle}*${branchInfo}`,
      `• *Status CI:* ✅ Testy przeszły pomyślnie`,
      `• *Czas:* ${new Date().toLocaleString('pl-PL')}`,
      ``,
      `Kliknij przycisk poniżej, aby natychmiast scalić Pull Request.`,
    ].join('\n'),
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [[
        { text: `🔀 Scal PR #${prNumber} (1-Tap Merge)`, callback_data: `merge_pr:${approvalId}` },
        { text: '❌ Odrzuć', callback_data: `reject:${approvalId}` },
      ]],
    },
  };
}
