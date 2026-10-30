import { spawn, exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';
import { notificationService } from '../notifications/notificationService.js';
import * as serversRepo from '../servers/serversRepository.js';
import { sshCmd } from '../utils/ssh.js';

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
    this.activeProcesses = new Map();
    this.activeTargets = ['ct8'];
    this.targetStates = {
      ct8: { state: 'IDLE', currentStep: 'Gotowy', logs: [] },
      omv: { state: 'IDLE', currentStep: 'Gotowy', logs: [] },
    };
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
      targetHost: data.targetHost || this.lastDeploy.targetHost || 'dashboard.jagger2.ct8.pl',
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
      activeTargets: this.activeTargets,
      targetStates: this.targetStates,
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

  startDeploy({ environment = 'production', targets = ['ct8'] } = {}) {
    if (this.state === 'RUNNING') {
      throw new Error('Wdrożenie jest już w toku.');
    }

    const deployTargets = Array.isArray(targets) && targets.length > 0 ? targets : ['ct8'];
    this.activeTargets = deployTargets;
    this.state = 'RUNNING';
    this.startTime = new Date().toISOString();
    this.currentStep = `Inicjalizacja wdrożenia na cel(e): ${deployTargets.join(', ')}...`;
    this.logs = [];

    // Initialize per-target states
    this.targetStates = {};
    for (const t of deployTargets) {
      this.targetStates[t] = {
        state: 'RUNNING',
        currentStep: 'Inicjalizacja...',
        logs: [],
      };
    }

    const startEpoch = Date.now();
    this.appendLog(`[SYSTEM] Rozpoczęto wdrożenie na środowisko: ${environment} [Cele: ${deployTargets.join(', ')}]`);
    this.broadcast('deploy:status', this.getStatus());

    // Run targets in parallel
    const targetPromises = deployTargets.map((target) => this.runSingleTarget(target, environment));

    Promise.allSettled(targetPromises).then((results) => {
      const allSuccess = results.every((r) => r.status === 'fulfilled' && r.value.success);
      const errors = results
        .filter((r) => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success))
        .map((r) => (r.status === 'rejected' ? r.reason?.message : r.value?.error))
        .filter(Boolean);

      const errorReason = allSuccess ? null : errors.join('; ') || 'Wystąpił błąd wdrożenia na wybrane serwery';
      this.finishDeploy(allSuccess, errorReason, startEpoch);
    });

    return {
      success: true,
      message: `Wdrożenie uruchomione na cele: ${deployTargets.join(', ')}`,
      targets: deployTargets,
    };
  }

  runSingleTarget(target, environment) {
    return new Promise((resolve) => {
      let scriptPath = '';
      if (target === 'omv') {
        scriptPath = path.join(REPO_ROOT, 'scripts', 'deploy-omv.sh');
      } else {
        scriptPath = path.join(REPO_ROOT, 'scripts', 'deploy-ct8-optimized.sh');
      }

      this.appendLog(`[${target.toUpperCase()}] Start procesu wdrożenia...`, target);

      try {
        const proc = spawn('bash', [scriptPath, environment], {
          cwd: REPO_ROOT,
          env: {
            ...process.env,
            NODE_ENV: environment,
          },
        });

        this.activeProcesses.set(target, proc);
        if (target === 'ct8' || !this.activeProcess) {
          this.activeProcess = proc;
        }

        const handleData = (chunk) => {
          const text = chunk.toString();
          const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
          for (const line of lines) {
            this.appendLog(line, target);
            this.parseStep(line, target);
          }
        };

        proc.stdout.on('data', handleData);
        proc.stderr.on('data', handleData);

        proc.on('error', (err) => {
          logger.error({ err, target }, `Error spawning deploy script for target ${target}`);
          if (this.targetStates[target]) {
            this.targetStates[target].state = 'FAILED';
            this.targetStates[target].currentStep = `Błąd procesu: ${err.message}`;
          }
          this.activeProcesses.delete(target);
          resolve({ success: false, target, error: err.message });
        });

        proc.on('close', (code) => {
          this.activeProcesses.delete(target);
          if (this.activeProcess === proc) {
            this.activeProcess = null;
          }
          const success = code === 0;
          if (this.targetStates[target]) {
            this.targetStates[target].state = success ? 'SUCCESS' : 'FAILED';
            this.targetStates[target].currentStep = success
              ? 'Zakończono pomyślnie'
              : `Kod błędu: ${code}`;
          }
          this.appendLog(`[${target.toUpperCase()}] Proces zakończony kodem: ${code}`, target);
          resolve({ success, target, error: success ? null : `Kod wyjścia ${code}` });
        });
      } catch (err) {
        this.activeProcesses.delete(target);
        if (this.targetStates[target]) {
          this.targetStates[target].state = 'FAILED';
          this.targetStates[target].currentStep = `Błąd: ${err.message}`;
        }
        resolve({ success: false, target, error: err.message });
      }
    });
  }

  finishDeploy(success, errorReason, startEpoch) {
    const durationSeconds = Math.round((Date.now() - startEpoch) / 1000);
    this.state = success ? 'SUCCESS' : 'FAILED';
    this.currentStep = success
      ? 'Wdrożenie zakończone pomyślnie'
      : `Błąd wdrożenia: ${errorReason || 'Nieznany błąd'}`;

    this.saveLastDeploy({
      status: this.state,
      timestamp: new Date().toISOString(),
      durationSeconds,
      error: errorReason,
      activeTargets: this.activeTargets,
    });

    this.appendLog(`[SYSTEM] Wdrożenie zakończone ze statusem: ${this.state} (${durationSeconds}s)`);
    this.broadcast('deploy:status', this.getStatus());
    this.broadcast('deploy:finished', {
      success,
      durationSeconds,
      error: errorReason,
      activeTargets: this.activeTargets,
    });

    notificationService.notify('deploy:finished', {
      success,
      durationSeconds,
      error: errorReason,
      targetHost: 'dashboard.jagger2.ct8.pl',
    });
  }

  appendLog(line, target = 'ct8') {
    const cleanText = stripAnsi(line);
    if (!cleanText) return;

    const logEntry = {
      timestamp: new Date().toLocaleTimeString('pl-PL'),
      text: cleanText,
      target,
    };
    this.logs.push(logEntry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    if (this.targetStates[target]) {
      this.targetStates[target].logs.push(logEntry);
      if (this.targetStates[target].logs.length > this.maxLogs) {
        this.targetStates[target].logs.shift();
      }
    }

    this.broadcast('deploy:log', logEntry);
  }

  parseStep(line, target = 'ct8') {
    const clean = stripAnsi(line);
    let stepTitle = '';

    if (clean.includes('STEP 0')) {
      stepTitle = 'Krok 0: Weryfikacja poświadczeń i dostępności serwera';
    } else if (clean.includes('STEP 1')) {
      stepTitle = 'Krok 1: Weryfikacja i przygotowanie zasobów serwera';
    } else if (clean.includes('STEP 2')) {
      stepTitle = 'Krok 2: Wysyłanie plików i konfiguracji na serwer';
    } else if (clean.includes('STEP 3')) {
      stepTitle = 'Krok 3: Wykonywanie migracji bazy danych / weryfikacja usług';
    } else if (clean.includes('STEP 4')) {
      stepTitle = 'Krok 4: Przeładowanie usług i test weryfikacyjny';
    }

    if (stepTitle) {
      this.currentStep = `[${target.toUpperCase()}] ${stepTitle}`;
      if (this.targetStates[target]) {
        this.targetStates[target].currentStep = stepTitle;
      }
      this.broadcast('deploy:status', this.getStatus());
    }
  }

  abortDeploy() {
    let killedCount = 0;
    for (const [target, proc] of this.activeProcesses.entries()) {
      try {
        if (proc && !proc.killed) {
          proc.kill('SIGTERM');
          setTimeout(() => {
            try {
              if (proc && !proc.killed) proc.kill('SIGKILL');
            } catch {
              // ignore
            }
          }, 500);
          killedCount++;
        }
      } catch (err) {
        logger.warn({ err: err.message, target }, 'Failed to kill deploy process');
      }
    }
    this.activeProcesses.clear();
    this.activeProcess = null;

    const hadRunning = this.state === 'RUNNING' || killedCount > 0;
    this.state = 'FAILED';
    this.currentStep = 'Wdrożenie zatrzymane przez użytkownika';
    this.appendLog('[SYSTEM] 🛑 Wdrożenie zostało przerwane na żądanie użytkownika. Procesy ubite.');
    this.broadcast('deploy:status', this.getStatus());
    this.broadcast('deploy:finished', {
      success: false,
      durationSeconds: 0,
      error: 'Wdrożenie przerwane przez użytkownika',
      activeTargets: this.activeTargets,
    });

    return {
      success: true,
      message: hadRunning
        ? `Uruchomione procesy wdrożenia (${killedCount}) zostały pomyślnie zatrzymane.`
        : 'Brak aktywnego procesu wdrożenia do zatrzymania.',
    };
  }

  async killRemoteProcesses({ target = 'ct8' } = {}) {
    let sshCmdStr = 'ssh -i ~/.ssh/id_ed25519_antigravity -i ~/.ssh/id_rsa -o StrictHostKeyChecking=accept-new -o BatchMode=yes -o ConnectTimeout=10 jagger2@s1.ct8.pl';
    let remoteKillCmd = 'killall -9 node gitstatusd-freebsd-amd64 2>/dev/null || true; touch ~/domains/dashboard.jagger2.ct8.pl/tmp/restart.txt && devil www restart dashboard.jagger2.ct8.pl';

    if (target === 'omv') {
      sshCmdStr = 'ssh -i ~/.ssh/id_ed25519_antigravity -i ~/.ssh/id_rsa -o StrictHostKeyChecking=accept-new -o BatchMode=yes -o ConnectTimeout=10 root@10.10.10.100';
      remoteKillCmd = 'systemctl restart dashboard || docker restart dashboard 2>/dev/null || true';
    } else if (target.startsWith('custom_')) {
      const serverId = target.replace('custom_', '');
      try {
        const s = await serversRepo.getServerById(serverId, true);
        if (s) {
          sshCmdStr = sshCmd(s);
          if (s.use_devil || (s.host && s.host.includes('ct8.pl'))) {
            remoteKillCmd = 'killall -9 node gitstatusd-freebsd-amd64 2>/dev/null || true; devil www restart';
          } else {
            remoteKillCmd = 'killall -9 node 2>/dev/null || true';
          }
        }
      } catch {
        // use default
      }
    }

    this.appendLog(`[${target.toUpperCase()}] 🛑 Ubijanie zawieszonych procesów zdalnych i restart aplikacji...`, target);

    return new Promise((resolve) => {
      exec(`${sshCmdStr} "${remoteKillCmd}"`, { timeout: 15000 }, (error, stdout, stderr) => {
        if (error) {
          const errMsg = stderr || error.message;
          logger.warn({ error, target }, 'Error killing remote processes');
          this.appendLog(`[${target.toUpperCase()}] ⚠️ Błąd podczas ubijania procesów zdalnych: ${errMsg}`, target);
          resolve({
            success: false,
            message: `Nie udało się ubić procesów zdalnych: ${errMsg}`,
            error: errMsg,
          });
        } else {
          this.appendLog(`[${target.toUpperCase()}] ✓ Zawieszone procesy zdalne zostały ubite, a aplikacja zrestartowana.`, target);
          resolve({
            success: true,
            message: `Zawieszone procesy zdalne na ${target.toUpperCase()} zostały ubite, a aplikacja zrestartowana.`,
            output: stdout,
          });
        }
      });
    });
  }
}

export const deployService = new DeployService();
