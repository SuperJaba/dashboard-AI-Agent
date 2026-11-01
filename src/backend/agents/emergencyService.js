import { safeQuery } from '../db.js';
import * as llmServersRepo from '../llmServers/llmServersRepository.js';
import { activeAgentProcesses as defaultWorkerProcesses } from './backgroundWorker.js';

/**
 * Triggers an emergency kill-switch:
 * 1. Aborts any running agent tasks in the database.
 * 2. Kills active background agent subprocesses.
 * 3. Stops running local LLM servers to free VRAM.
 * 4. Broadcasts emergency:triggered over Socket.IO if io instance is supplied.
 *
 * @param {object} [options]
 * @param {Map} [options.activeProcesses]
 * @param {Function} [options.processKiller]
 * @param {object} [options.io]
 * @returns {Promise<{ success: boolean, terminatedTasks: number, killedProcesses: number, freedVram: boolean }>}
 */
export async function triggerEmergencyStop(options = {}) {
  const {
    activeProcesses = defaultWorkerProcesses,
    processKiller = (pid, signal) => {
      try {
        process.kill(pid, signal);
      } catch (err) {
        // Process might already be dead
        if (err.code !== 'ESRCH') {
          console.warn(`[EmergencyService] Failed to kill PID ${pid}:`, err.message);
        }
      }
    },
    io = null,
  } = options;

  let terminatedTasks = 0;
  let killedProcesses = 0;
  let freedVram = false;

  // 1. Mark active database tasks as aborted
  try {
    const res = await safeQuery(
      "UPDATE agent_tasks SET status = 'aborted' WHERE status = 'started'",
      []
    );
    terminatedTasks = res?.rowCount || res?.rows?.length || 0;
  } catch (err) {
    console.error('[EmergencyService] Error aborting agent tasks in DB:', err.message);
  }

  // 2. Terminate running background worker child processes
  if (activeProcesses && activeProcesses.size > 0) {
    for (const [name, proc] of activeProcesses.entries()) {
      try {
        if (typeof proc?.kill === 'function') {
          proc.kill('SIGTERM');
        } else if (proc?.pid) {
          processKiller(proc.pid, 'SIGTERM');
        }
        killedProcesses += 1;
      } catch (err) {
        console.warn(`[EmergencyService] Error killing process ${name}:`, err.message);
      }
    }
    activeProcesses.clear();
  }

  // 3. Unload local LLM servers to free VRAM
  try {
    const servers = await llmServersRepo.getLlmServers();
    const runningLocalServers = (servers || []).filter(
      (s) => Boolean(s.is_local) && s.status === 'running'
    );

    for (const server of runningLocalServers) {
      if (server.pid) {
        processKiller(server.pid, 'SIGTERM');
      }
      await llmServersRepo.updateLlmServerStatus(server.id, 'stopped');
      freedVram = true;
    }
  } catch (err) {
    console.error('[EmergencyService] Error stopping local LLM servers:', err.message);
  }

  const summary = {
    success: true,
    terminatedTasks,
    killedProcesses,
    freedVram,
  };

  // 4. Broadcast emergency event over Socket.IO
  if (io && typeof io.emit === 'function') {
    io.emit('emergency:triggered', summary);
  }

  return summary;
}
