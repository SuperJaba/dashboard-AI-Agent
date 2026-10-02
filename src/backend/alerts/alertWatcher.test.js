import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mockujemy node-fetch zanim zaimportujemy moduł
vi.mock('node-fetch', () => ({
  default: vi.fn(),
}));

// Mockujemy child_process.execSync z zachowaniem reszty
vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    execSync: vi.fn(),
  };
});

// Mockujemy logger aby nie zaśmiecać outputu testów
vi.mock('../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import fetch from 'node-fetch';
import { execSync } from 'child_process';
import {
  getAlertConfig,
  updateAlertConfig,
  registerAlertWebhook,
  getWebhooks,
  recordHttpError,
  checkThresholds,
  startAlertWatcher,
  stopAlertWatcher,
  _clearWebhooks,
  _setMetricsReader,
} from './alertWatcher.js';

/**
 * Pomocnicza fabryka JSON-a zwracanego przez sys-info.js
 */
function makeSysInfo({ cpuLoad = 0, memUsage = 0 } = {}) {
  return JSON.stringify({
    uptimeHours: 1,
    cpu: { model: 'Test CPU', cores: 4, loadAvg: { '1m': cpuLoad, '5m': 0, '15m': 0 } },
    memory: { total: '8 GB', used: '4 GB', free: '4 GB', usagePercent: memUsage },
    disk: { mount: '/', total: '100 GB', used: '10 GB', available: '90 GB', usagePercent: '10%' },
    topProcesses: [],
  });
}

describe('alertWatcher — T7.4', () => {
  beforeEach(() => {
    // Zresetuj konfigurację do wartości domyślnych
    updateAlertConfig({ cpuThreshold: 90, memThreshold: 85, httpErrorThreshold: 3, enabled: true });
    _clearWebhooks();
    _setMetricsReader(null);
    vi.clearAllMocks();
    fetch.mockResolvedValue({ status: 200 });
  });

  afterEach(() => {
    stopAlertWatcher();
  });

  // ── 1. Konfiguracja ─────────────────────────────────────────────────────────
  it('getAlertConfig zwraca domyślne progi po updateAlertConfig', () => {
    const cfg = getAlertConfig();
    expect(cfg.cpuThreshold).toBe(90);
    expect(cfg.memThreshold).toBe(85);
    expect(cfg.httpErrorThreshold).toBe(3);
    expect(cfg.enabled).toBe(true);
  });

  it('updateAlertConfig nadpisuje tylko podane pola', () => {
    updateAlertConfig({ cpuThreshold: 75 });
    const cfg = getAlertConfig();
    expect(cfg.cpuThreshold).toBe(75);
    expect(cfg.memThreshold).toBe(85); // niezmieniony
  });

  // ── 2. Rejestracja webhooków ─────────────────────────────────────────────────
  it('registerAlertWebhook dodaje URL do listy, duplikaty ignoruje', () => {
    // Zarejestruj wcześniej pusty moduł — nie mamy resetu, więc testujemy na tym co mamy
    const url = 'https://example.com/hook-unique-' + Date.now();
    const before = getWebhooks().length;
    registerAlertWebhook(url);
    registerAlertWebhook(url); // duplikat
    expect(getWebhooks().length).toBe(before + 1);
    expect(getWebhooks()).toContain(url);
  });

  // ── 3. Dispatch alertu CPU ───────────────────────────────────────────────────
  it('checkThresholds wywołuje fetch gdy CPU przekracza próg', async () => {
    const hookUrl = 'https://example.com/cpu-hook-' + Date.now();
    registerAlertWebhook(hookUrl);

    _setMetricsReader(() => ({ cpuLoad1m: 95, memUsagePercent: 30 }));

    await checkThresholds();

    expect(fetch).toHaveBeenCalledWith(
      hookUrl,
      expect.objectContaining({ method: 'POST' }),
    );

    const body = JSON.parse(fetch.mock.calls.find(([u]) => u === hookUrl)?.[1]?.body ?? '{}');
    expect(body.type).toBe('cpu');
    expect(body.value).toBe(95);
  });

  // ── 4. Dispatch alertu pamięci ───────────────────────────────────────────────
  it('checkThresholds wywołuje fetch gdy RAM przekracza próg', async () => {
    const hookUrl = 'https://example.com/mem-hook-' + Date.now();
    registerAlertWebhook(hookUrl);

    _setMetricsReader(() => ({ cpuLoad1m: 10, memUsagePercent: 90 }));

    await checkThresholds();

    const memCall = fetch.mock.calls.find(([u]) => u === hookUrl);
    expect(memCall).toBeDefined();
    const body = JSON.parse(memCall[1].body);
    expect(body.type).toBe('memory');
    expect(body.value).toBe(90);
  });

  // ── 5. Dispatch alertu błędów HTTP 5xx ──────────────────────────────────────
  it('checkThresholds wywołuje fetch gdy przekroczono próg błędów HTTP 5xx', async () => {
    const hookUrl = 'https://example.com/http-hook-' + Date.now();
    registerAlertWebhook(hookUrl);

    // CPU i pamięć w normie
    execSync.mockReturnValue(makeSysInfo({ cpuLoad: 5, memUsage: 40 }));

    // Zarejestruj 3 błędy
    recordHttpError();
    recordHttpError();
    recordHttpError();

    await checkThresholds();

    const httpCall = fetch.mock.calls.find(([u]) => u === hookUrl);
    expect(httpCall).toBeDefined();
    const body = JSON.parse(httpCall[1].body);
    expect(body.type).toBe('http_errors');
    expect(body.value).toBeGreaterThanOrEqual(3);
  });

  // ── 6. Brak alertu gdy poniżej progów ───────────────────────────────────────
  it('checkThresholds NIE wywołuje fetch gdy wartości poniżej progów', async () => {
    _setMetricsReader(() => ({ cpuLoad1m: 10, memUsagePercent: 50 }));
    // Nie rejestrujemy żadnych błędów HTTP (lub mniej niż próg)

    const hookUrl = 'https://example.com/ok-hook-' + Date.now();
    registerAlertWebhook(hookUrl);

    // Upewnij się, że licznik błędów jest < 3
    updateAlertConfig({ httpErrorThreshold: 100 });

    await checkThresholds();

    const relevantCalls = fetch.mock.calls.filter(([u]) => u === hookUrl);
    expect(relevantCalls.length).toBe(0);
  });

  // ── 7. Disabled watcher ──────────────────────────────────────────────────────
  it('checkThresholds nic nie robi gdy enabled=false', async () => {
    updateAlertConfig({ enabled: false });
    _setMetricsReader(() => ({ cpuLoad1m: 99, memUsagePercent: 99 }));

    const hookUrl = 'https://example.com/disabled-hook-' + Date.now();
    registerAlertWebhook(hookUrl);

    await checkThresholds();

    const calls = fetch.mock.calls.filter(([u]) => u === hookUrl);
    expect(calls.length).toBe(0);
  });

  // ── 8. Błąd readSystemMetrics nie przerywa pracy ───────────────────────────
  it('checkThresholds nie rzuca gdy readSystemMetrics zawiedzie', async () => {
    _setMetricsReader(() => { throw new Error('metrics error'); });

    // Nie powinno rzucić wyjątku
    await expect(checkThresholds()).resolves.not.toThrow();
  });

  // ── 9. startAlertWatcher / stopAlertWatcher ──────────────────────────────────
  it('startAlertWatcher uruchamia interval, stopAlertWatcher go zatrzymuje', () => {
    startAlertWatcher();
    // Drugi call nie powinien tworzyć drugiego intervalu
    startAlertWatcher();

    stopAlertWatcher();
    // Po zatrzymaniu można uruchomić ponownie
    startAlertWatcher();
    stopAlertWatcher();
  });

  // ── 10. Timestamp w payloadzie alertu ───────────────────────────────────────
  it('alert payload zawiera pole timestamp w formacie ISO 8601', async () => {
    const hookUrl = 'https://example.com/ts-hook-' + Date.now();
    registerAlertWebhook(hookUrl);

    _setMetricsReader(() => ({ cpuLoad1m: 95, memUsagePercent: 10 }));

    await checkThresholds();

    const call = fetch.mock.calls.find(([u]) => u === hookUrl);
    expect(call).toBeDefined();
    const body = JSON.parse(call[1].body);
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
