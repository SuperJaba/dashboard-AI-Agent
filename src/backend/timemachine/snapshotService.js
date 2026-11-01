import crypto from 'crypto';
import fs from 'fs';
import chokidar from 'chokidar';
import { createPatch } from 'diff';
import { safeQuery } from '../db.js';

export const activeSessions = new Map();

let lastSeq = 0;
function nextSeq() {
  const now = Date.now();
  lastSeq = now > lastSeq ? now : lastSeq + 1;
  return lastSeq;
} // sessionId -> { watcher, agentName, workdir, fileCache }

/**
 * Starts a new time-machine recording session for an agent.
 * Initializes chokidar watcher on the agent's workdir (if provided).
 */
export async function startSession(agentName, workdir, options = {}) {
  const sessionId = crypto.randomUUID();
  const fileCache = new Map(); // path -> last known content

  let watcher = null;
  if (workdir && options.watch !== false) {
    watcher = chokidar.watch(workdir, {
      ignored: /node_modules|\.git|dist|coverage/,
      persistent: true,
      ignoreInitial: true,
    });

    watcher.on('change', async (filePath) => {
      try {
        if (!fs.existsSync(filePath)) return;
        const newContent = fs.readFileSync(filePath, 'utf-8');
        const oldContent = fileCache.get(filePath) ?? '';
        fileCache.set(filePath, newContent);
        await recordFileWrite(sessionId, filePath, oldContent, newContent);
      } catch (err) {
        console.warn(`[snapshotService] Watcher change error for ${filePath}:`, err.message);
      }
    });
  }

  activeSessions.set(sessionId, { watcher, agentName, workdir, fileCache });

  await safeQuery(
    'INSERT INTO snapshot_sessions (id, agent_name, started_at) VALUES (?, ?, ?)',
    [sessionId, agentName, new Date().toISOString()]
  );

  return sessionId;
}

/**
 * Records a file mutation event with unified diff.
 */
export async function recordFileWrite(sessionId, filePath, oldContent, newContent) {
  const diff = createPatch(filePath, oldContent ?? '', newContent ?? '');
  const id = crypto.randomUUID();
  const seq = nextSeq();
  const ts = new Date().toISOString();

  await safeQuery(
    'INSERT INTO snapshot_events (id, session_id, seq, ts, type, path, diff) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, sessionId, seq, ts, 'file_write', filePath, diff]
  );

  return {
    id,
    sessionId,
    seq,
    ts,
    type: 'file_write',
    path: filePath,
    filePath,
    diff
  };
}

/**
 * Records a bash command execution event.
 */
export async function recordBashCmd(sessionId, cmdline, exitCode) {
  const id = crypto.randomUUID();
  const seq = nextSeq();
  const ts = new Date().toISOString();

  await safeQuery(
    'INSERT INTO snapshot_events (id, session_id, seq, ts, type, cmdline, exit_code) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, sessionId, seq, ts, 'bash_cmd', cmdline, exitCode]
  );

  return {
    id,
    sessionId,
    seq,
    ts,
    type: 'bash_cmd',
    cmdline,
    exitCode,
    exit_code: exitCode
  };
}

/**
 * Returns all recorded events for a given session, ordered chronologically by seq.
 */
export async function getEvents(sessionId) {
  const res = await safeQuery(
    'SELECT * FROM snapshot_events WHERE session_id = ? ORDER BY seq ASC',
    [sessionId]
  );
  return res?.rows || [];
}

/**
 * Closes the file watcher and marks the session as stopped.
 */
export async function stopSession(sessionId) {
  const session = activeSessions.get(sessionId);
  if (session?.watcher) {
    try {
      await session.watcher.close();
    } catch (err) {
      console.warn(`[snapshotService] Error closing watcher for ${sessionId}:`, err.message);
    }
  }

  activeSessions.delete(sessionId);
  const stoppedAt = new Date().toISOString();

  await safeQuery(
    'UPDATE snapshot_sessions SET stopped_at = ?, ended_at = ? WHERE id = ?',
    [stoppedAt, stoppedAt, sessionId]
  );

  return { id: sessionId, stopped_at: stoppedAt };
}

/**
 * Retrieves the in-memory active session metadata.
 */
export function getActiveSession(sessionId) {
  return activeSessions.get(sessionId);
}
