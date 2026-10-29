import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';
import { notificationService } from '../notifications/notificationService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../../');
const LAST_DEPLOY_FILE = path.join(REPO_ROOT, '.last_deploy.json');

// eslint-disable-next-line no-control-regex
const ANSI_REGEX = /[\u001b\x1b]\[[0-9;]*[a-zA-Z]/g;
const ORPHANED_ANSI_REGEX = /\[[0-9;]+m/g;

/**
 * Strips ANSI color/escape sequences and stray formatting artifacts (like [0m)
 */
export function stripAnsi(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(ANSI_REGEX, '')
    .replace(ORPHANED_ANSI_REGEX, '')
    .replace(/\r/g, '')
    .trim();
}

class DeployService {
  constructor() {
    this.state = 'IDLE'; // 'IDLE' | 'RUNNING' | 'SUCCESS' | 'FAILED'
    this.currentStep = 'Oczekiwanie na uruchomienie';
    this.startTime = null;
    this.logs = [];
    this.maxLogs = 300;
    this.lastDeploy = this.loadLastDeploy();
    this.activeProcess = null;
    this.io = null;
  }

  setSocketServer(io) {
    this.io = io;
  }

  loadLastDeploy() {
    try {
      if (fs.existsSync(LAST_DEPLOY_FILE)) {
        const raw = fs.readFileSync(LAST_DEPLOY_FILE, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (err) {
      logger.warn({ err: err.message }, 'Could not read .last_deploy.json');
    }
    return {
      status: 'NEVER_RUN',
      timestamp: null,
      durationSeconds: 0,
      targetHost: 'dashboard.jagger2.ct8.pl',
      error: null,
    };
  }

  saveLastDeploy(data) {
    this.lastDeploy = {
      ...this.lastDeploy,
      ...data,
      targetHost: 'dashboard.jagger2.ct8.pl',
    };
    try {
      fs.writeFileSync(LAST_DEPLOY_FILE, JSON.stringify(this.lastDeploy, null, 2), 'utf-8');
    } catch (err) {
      logger.warn({ err: err.message }, 'Could not save .last_deploy.json');
    }
  }

  broadcast(event, payload) {
    if (!this.io) return;
    try {
      const dashNsp = this.io.of('/dashboard');
      dashNsp.emit(event, {
        timestamp: new Date().toISOString(),
        ...payload,
      });
    } catch (err) {
      logger.error({ err: err.message }, 'Failed to broadcast deploy socket event');
    }
  }

  getStatus() {
    return {
      state: this.state,
      isDeploying: this.state === 'RUNNING',
      currentStep: this.currentStep,
      startTime: this.startTime,
      logs: this.logs,
      lastDeploy: this.lastDeploy,
      targetHost: 'dashboard.jagger2.ct8.pl',
    };
  }

  async checkHealth(targetUrl = 'https://dashboard.jagger2.ct8.pl/health') {
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(targetUrl, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Dashboard-HealthCheck/1.0' },
      });
      clearTimeout(timeoutId);

      const latencyMs = Date.now() - start;
      const ok = res.ok;
      let body = null;
      try {
        body = await res.json();
      } catch {
        // Body might not be JSON
      }

      return {
        healthy: ok,
        statusCode: res.status,
        latencyMs,
        timestamp: new Date().toISOString(),
        details: body,
      };
    } catch (err) {
      const latencyMs = Date.now() - start;
      return {
        healthy: false,
        statusCode: 0,
        latencyMs,
        timestamp: new Date().toISOString(),
        error: err.message,
      };
    }
  }

  startDeploy({ environment = 'production' } = {}) {
    if (this.state === 'RUNNING') {
      throw new Error('Wdrożenie jest już w toku.');
    }

    this.state = 'RUNNING';
    this.startTime = new Date().toISOString();
    this.currentStep = 'Inicjalizacja skryptu wdrożeniowego...';
    this.logs = [];

    const scriptPath = path.join(REPO_ROOT, 'scripts', 'deploy-ct8-optimized.sh');
    const startEpoch = Date.now();

    this.appendLog(`[SYSTEM] Rozpoczęto wdrożenie na środowisko: ${environment}`);
    this.broadcast('deploy:status', this.getStatus());

    try {
      this.activeProcess = spawn('bash', [scriptPath, environment], {
        cwd: REPO_ROOT,
        env: {
          ...process.env,
          NODE_ENV: environment,
        },
      });

      const handleData = (chunk) => {
        const text = chunk.toString();
        const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
        for (const line of lines) {
          this.appendLog(line);
          this.parseStep(line);
        }
      };

      this.activeProcess.stdout.on('data', handleData);
      this.activeProcess.stderr.on('data', handleData);

      this.activeProcess.on('error', (err) => {
        logger.error({ err }, 'Error spawning deploy script');
        this.finishDeploy(false, `Błąd uruchomienia procesu: ${err.message}`, startEpoch);
      });

      this.activeProcess.on('close', (code) => {
        this.activeProcess = null;
        const success = code === 0;
        const reason = success ? null : `Proces zakończył się kodem błędu ${code}`;
        this.finishDeploy(success, reason, startEpoch);
      });

      return { success: true, message: 'Wdrożenie uruchomione' };
    } catch (err) {
      this.activeProcess = null;
      this.finishDeploy(false, err.message, startEpoch);
      throw err;
    }
  }

  finishDeploy(success, errorReason, startEpoch) {
    const durationSeconds = Math.round((Date.now() - startEpoch) / 1000);
    this.state = success ? 'SUCCESS' : 'FAILED';
    this.currentStep = success ? 'Wdrożenie zakończone pomyślnie' : `Błąd wdrożenia: ${errorReason || 'Nieznany błąd'}`;

    this.saveLastDeploy({
      status: this.state,
      timestamp: new Date().toISOString(),
      durationSeconds,
      error: errorReason,
    });

    this.appendLog(`[SYSTEM] Wdrożenie zakończone ze statusem: ${this.state} (${durationSeconds}s)`);
    this.broadcast('deploy:status', this.getStatus());
    this.broadcast('deploy:finished', {
      success,
      durationSeconds,
      error: errorReason,
    });

    notificationService.notify('deploy:finished', {
      success,
      durationSeconds,
      error: errorReason,
      targetHost: 'dashboard.jagger2.ct8.pl',
    });
  }

  appendLog(line) {
    const cleanText = stripAnsi(line);
    if (!cleanText) return;

    const logEntry = {
      timestamp: new Date().toLocaleTimeString('pl-PL'),
      text: cleanText,
    };
    this.logs.push(logEntry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
    this.broadcast('deploy:log', logEntry);
  }

  parseStep(line) {
    const clean = stripAnsi(line);
    if (clean.includes('STEP 0')) {
      this.currentStep = 'Krok 0: Weryfikacja poświadczeń i dostępności serwera';
      this.broadcast('deploy:status', this.getStatus());
    } else if (clean.includes('STEP 1')) {
      this.currentStep = 'Krok 1: Weryfikacja i przygotowanie paczki frontendu';
      this.broadcast('deploy:status', this.getStatus());
    } else if (clean.includes('STEP 2')) {
      this.currentStep = 'Krok 2: Wysyłanie plików backendu i zasobów na CT8';
      this.broadcast('deploy:status', this.getStatus());
    } else if (clean.includes('STEP 3')) {
      this.currentStep = 'Krok 3: Wykonywanie migracji bazy danych PostgreSQL';
      this.broadcast('deploy:status', this.getStatus());
    } else if (clean.includes('STEP 4')) {
      this.currentStep = 'Krok 4: Przeładowanie Passenger i test /health';
      this.broadcast('deploy:status', this.getStatus());
    }
  }
}

export const deployService = new DeployService();
