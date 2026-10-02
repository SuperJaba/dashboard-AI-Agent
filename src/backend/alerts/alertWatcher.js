import { execSync } from 'child_process';
import fetch from 'node-fetch';
import { logger } from '../utils/logger.js';

/**
 * T7.4 — Alert Watcher & Dispatcher
 *
 * Monitoruje zasoby systemowe i błędy HTTP 5xx.
 * Triggeruje powiadomienia do zarejestrowanych webhooków.
 */

// ── Konfiguracja domyślna ────────────────────────────────────────────────────
let config = {
  cpuThreshold: 90,       // % CPU
  memThreshold: 85,       // % RAM
  httpErrorThreshold: 3,  // błędy 5xx w ciągu 60s
  enabled: true,
};

// ── Lista webhooków (Feature 3 — in-memory) ──────────────────────────────────
const webhooks = [];

// ── Licznik błędów HTTP 5xx w oknie 60s ─────────────────────────────────────
const httpErrorWindow = [];     // tablica timestampów błędów 5xx

let watcherIntervalId = null;

// ── Publiczne API ────────────────────────────────────────────────────────────

/**
 * Rejestruje URL webhooka do powiadomień alertów.
 * @param {string} url - Adres URL webhooka (POST)
 */
export function registerAlertWebhook(url) {
  if (!webhooks.includes(url)) {
    webhooks.push(url);
    logger.info({ url }, 'Alert webhook zarejestrowany');
  }
}

/**
 * Zwraca listę zarejestrowanych webhooków.
 */
export function getWebhooks() {
  return [...webhooks];
}

export function _clearWebhooks() {
  webhooks.length = 0;
}

/**
 * Pobiera aktualną konfigurację progów.
 */
export function getAlertConfig() {
  return { ...config };
}

/**
 * Aktualizuje konfigurację progów alertów.
 * @param {object} newConfig - Częściowy obiekt konfiguracji
 */
export function updateAlertConfig(newConfig) {
  config = { ...config, ...newConfig };
  logger.info({ config }, 'Konfiguracja alertów zaktualizowana');
}

/**
 * Rejestruje błąd HTTP 5xx (wywoływane z middleware).
 */
export function recordHttpError() {
  httpErrorWindow.push(Date.now());
}

// ── Logika wewnętrzna ────────────────────────────────────────────────────────

let customMetricsReader = null;

export function _setMetricsReader(reader) {
  customMetricsReader = reader;
}

/**
 * Odczytuje metryki systemowe przez scripts/sys-info.js --compact.
 * @returns {{ cpuLoad1m: number, memUsagePercent: number }|null}
 */
function readSystemMetrics() {
  if (customMetricsReader) {
    try {
      return customMetricsReader();
    } catch (err) {
      logger.warn({ err: err.message }, 'Nie udało się odczytać metryk z customMetricsReader');
      return null;
    }
  }
  try {
    const raw = execSync('node scripts/sys-info.js --compact', {
      encoding: 'utf8',
      timeout: 10_000,
    });
    const data = JSON.parse(raw.trim());
    return {
      cpuLoad1m: data?.cpu?.loadAvg?.['1m'] ?? 0,
      memUsagePercent: data?.memory?.usagePercent ?? 0,
    };
  } catch (err) {
    logger.warn({ err: err.message }, 'Nie udało się odczytać metryk systemowych');
    return null;
  }
}

/**
 * Zlicza błędy HTTP 5xx z ostatnich 60 sekund.
 */
function countRecentHttpErrors() {
  const cutoff = Date.now() - 60_000;
  // Usuń stare wpisy
  while (httpErrorWindow.length > 0 && httpErrorWindow[0] < cutoff) {
    httpErrorWindow.shift();
  }
  return httpErrorWindow.length;
}

/**
 * Wysyła powiadomienie alertu do wszystkich zarejestrowanych webhooków.
 * @param {object} alert - Obiekt alertu { type, message, value, threshold }
 */
async function dispatchAlert(alert) {
  if (webhooks.length === 0) {
    logger.warn({ alert }, 'Brak webhooków do powiadomienia');
    return;
  }

  const payload = {
    timestamp: new Date().toISOString(),
    ...alert,
  };

  logger.warn({ payload }, 'Wysyłanie alertu do webhooków');

  const dispatches = webhooks.map(async (url) => {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5_000),
      });
      logger.info({ url, status: res.status }, 'Alert dostarczony');
    } catch (err) {
      logger.error({ url, err: err.message }, 'Błąd dostarczania alertu do webhooka');
    }
  });

  await Promise.allSettled(dispatches);
}

/**
 * Pojedyncze sprawdzenie progów.
 * Wywoływane przez setInterval.
 */
export async function checkThresholds() {
  if (!config.enabled) return;

  const metrics = readSystemMetrics();
  const httpErrors = countRecentHttpErrors();

  if (metrics) {
    const { cpuLoad1m, memUsagePercent } = metrics;

    if (cpuLoad1m > config.cpuThreshold) {
      await dispatchAlert({
        type: 'cpu',
        message: `Wysokie obciążenie CPU: ${cpuLoad1m}% (próg: ${config.cpuThreshold}%)`,
        value: cpuLoad1m,
        threshold: config.cpuThreshold,
      });
    }

    if (memUsagePercent > config.memThreshold) {
      await dispatchAlert({
        type: 'memory',
        message: `Wysokie zużycie pamięci: ${memUsagePercent}% (próg: ${config.memThreshold}%)`,
        value: memUsagePercent,
        threshold: config.memThreshold,
      });
    }
  }

  if (httpErrors >= config.httpErrorThreshold) {
    await dispatchAlert({
      type: 'http_errors',
      message: `${httpErrors} błędów HTTP 5xx w ciągu ostatnich 60s (próg: ${config.httpErrorThreshold})`,
      value: httpErrors,
      threshold: config.httpErrorThreshold,
    });
  }
}

/**
 * Uruchamia watcher alertów co 30 sekund.
 * Nie blokuje event loop.
 */
export function startAlertWatcher() {
  if (watcherIntervalId !== null) {
    logger.warn('Alert watcher już uruchomiony');
    return;
  }

  logger.info({ config }, 'Alert watcher uruchomiony (interval: 30s)');

  watcherIntervalId = setInterval(() => {
    checkThresholds().catch((err) => {
      logger.error({ err: err.message }, 'Błąd podczas sprawdzania progów alertów');
    });
  }, 30_000);

  // Nie blokuje exit Node.js
  if (watcherIntervalId.unref) {
    watcherIntervalId.unref();
  }
}

/**
 * Zatrzymuje watcher alertów (przydatne w testach).
 */
export function stopAlertWatcher() {
  if (watcherIntervalId !== null) {
    clearInterval(watcherIntervalId);
    watcherIntervalId = null;
    logger.info('Alert watcher zatrzymany');
  }
}
