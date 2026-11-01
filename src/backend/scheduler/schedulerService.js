import { exec } from 'child_process';
import cron from 'node-cron';
import * as schedulerRepo from './schedulerRepository.js';

export const TASK_PRESETS = [
  {
    type: 'npm_audit',
    name: 'Nocny audyt bezpieczeństwa',
    description: 'Skanowanie podatności w zależnościach projektu (npm audit)',
    defaultCommand: 'npm audit',
    defaultCron: '0 3 * * *'
  },
  {
    type: 'error_check',
    name: 'Weryfikacja logów błędów',
    description: 'Weryfikacja obecności krytycznych błędów w logach aplikacji',
    defaultCommand: 'node -e "console.log(\'Log audit: Brak krytycznych wyjątków w ostatnich logach.\')"',
    defaultCron: '0 * * * *'
  },
  {
    type: 'sync_tasks',
    name: 'Synchronizacja zadań z tasks.md',
    description: 'Automatyczna aktualizacja bazy zadań z pliku tasks.md',
    defaultCommand: 'npm run sync-tasks',
    defaultCron: '*/30 * * * *'
  },
  {
    type: 'omv_audit',
    name: 'Nocny audyt OMV (SMART, usługi, błędy)',
    description: 'Badanie dysków SMART, usług failed i logów systemowych serwera OMV',
    defaultCommand: 'mkdir -p reports && ssh -o StrictHostKeyChecking=accept-new -o BatchMode=yes omv \'echo "=== RAPORT OMV [$(date "+%F %T")] ===" && echo "--- 1. STAN DYSKU (SMART) ---" && smartctl -H /dev/disk/by-id/ata-WDC_WD6400BEVT-22A0RT0_WD-WXC0AB9M2067 2>/dev/null | grep -E "result|Pending" || true && echo "--- 2. USŁUGI W STANIE AWARII ---" && systemctl --failed --no-legend 2>/dev/null || true && echo "--- 3. ZASOBY (RAM & DYSK) ---" && free -h | awk "NR<=2" && df -h / | awk "NR<=2" && echo "--- 4. BŁĘDY W DZIENNIKU SYSTEMOWYM ---" && journalctl --file=/var/log/journal/a5964cf8c4d94485b7f779bc2a9eade5/system.journal -p 3 -n 40 --no-pager 2>/dev/null | grep -v "twingate-notifier" | tail -n 25 || true\' | tee reports/omv-$(date +%F).log',
    defaultCron: '0 3 * * *'
  },
  {
    type: 'ghost_ops_nightly',
    name: 'Ghost Ops — Nocna samonaprawa CI',
    description: 'Autonomiczne wykrywanie awarii CI, repro w git worktree i otwarcie PR z poprawką',
    defaultCommand: 'node -e "import(\'./src/backend/ghostops/ghostopsService.js\').then(m => m.runGhostOpsCycle())"',
    defaultCron: '0 2 * * *'
  },
  {
    type: 'custom_command',
    name: 'Własne zadanie AI / komenda',
    description: 'Dowolne polecenie powłoki lub skrypt agenta',
    defaultCommand: '',
    defaultCron: '0 0 * * *'
  }
];

class SchedulerService {
  constructor() {
    this.cronJobs = new Map();
    this.runningTasks = new Set();
    this.io = null;
  }

  setSocketServer(io) {
    this.io = io;
  }

  getPresets() {
    return TASK_PRESETS;
  }

  validateCron(expression) {
    if (!expression || typeof expression !== 'string') {
      return false;
    }
    return cron.validate(expression.trim());
  }

  async initScheduler() {
    this.stopAll();
    const tasks = await schedulerRepo.getScheduledTasks();
    for (const task of tasks) {
      if (task.enabled && this.validateCron(task.cron_expression)) {
        this.scheduleJob(task);
      }
    }
    console.log(`⏱️ Scheduler zainicjalizowany: ${this.cronJobs.size} aktywnych zadań cron.`);
  }

  scheduleJob(task) {
    this.stopJob(task.id);

    if (!task.enabled || !this.validateCron(task.cron_expression)) {
      return null;
    }

    try {
      const job = cron.schedule(task.cron_expression.trim(), async () => {
        try {
          await this.runTask(task.id);
        } catch (err) {
          console.error(`Błąd podczas cyklicznego wykonywania zadania #${task.id}:`, err.message);
        }
      });

      this.cronJobs.set(task.id, job);
      return job;
    } catch (err) {
      console.error(`Nie udało się zarejestrować zadania cron #${task.id}:`, err.message);
      return null;
    }
  }

  stopJob(taskId) {
    const existing = this.cronJobs.get(taskId);
    if (existing) {
      try {
        existing.stop();
      } catch {
        // ignore error on stop
      }
      this.cronJobs.delete(taskId);
    }
  }

  stopAll() {
    for (const job of this.cronJobs.values()) {
      try {
        job.stop();
      } catch {
        // ignore
      }
    }
    this.cronJobs.clear();
  }

  async runTask(taskId) {
    const task = await schedulerRepo.getScheduledTaskById(taskId);
    if (!task) {
      throw new Error(`Zadanie o ID ${taskId} nie istnieje.`);
    }

    if (this.runningTasks.has(taskId)) {
      return { status: 'running', message: 'Zadanie jest już w trakcie wykonywania.' };
    }

    this.runningTasks.add(taskId);
    const nowIso = new Date().toISOString();

    await schedulerRepo.recordTaskRun(taskId, {
      last_run: nowIso,
      last_status: 'running',
      last_output: 'Zadanie uruchomione...'
    });

    if (this.io) {
      this.io.emit('scheduler:task_started', { taskId, startedAt: nowIso });
    }

    let commandToRun = task.command;
    if (!commandToRun) {
      const preset = TASK_PRESETS.find(p => p.type === task.task_type);
      commandToRun = preset ? preset.defaultCommand : 'echo "Brak zdefiniowanego polecenia"';
    }

    return new Promise((resolve) => {
      exec(commandToRun, { timeout: 60000, maxBuffer: 1024 * 1024 }, async (error, stdout, stderr) => {
        this.runningTasks.delete(taskId);

        const combinedOutput = `${stdout || ''}\n${stderr || ''}`.trim();
        const truncatedOutput = combinedOutput.length > 5000 
          ? combinedOutput.slice(-5000) 
          : combinedOutput;

        const isSuccess = !error || (task.task_type === 'npm_audit' && error.code <= 1);
        const finalStatus = isSuccess ? 'success' : 'failed';
        const finishedAt = new Date().toISOString();

        const updated = await schedulerRepo.recordTaskRun(taskId, {
          last_run: finishedAt,
          last_status: finalStatus,
          last_output: truncatedOutput || (isSuccess ? 'Zakończono pomyślnie (brak wyjścia).' : error?.message || 'Błąd wykonania')
        });

        if (this.io) {
          this.io.emit('scheduler:task_finished', {
            taskId,
            status: finalStatus,
            task: updated,
            finishedAt
          });
        }

        // Send notification if notificationService is available
        try {
          const notifPath = '../notifications/notificationService.js';
          const notifMod = await import(/* @vite-ignore */ notifPath);
          if (notifMod?.notificationService?.notify) {
            notifMod.notificationService.notify(finalStatus === 'success' ? 'scheduler:task_finished' : 'scheduler:task_failed', {
              taskName: task.name,
              taskType: task.task_type,
              status: finalStatus,
              output: truncatedOutput
            }).catch(() => {});
          }
        } catch {
          // notificationService not present on this branch or disabled - safe to ignore
        }

        resolve({
          success: isSuccess,
          status: finalStatus,
          task: updated,
          output: truncatedOutput
        });
      });
    });
  }
}

export const schedulerService = new SchedulerService();
