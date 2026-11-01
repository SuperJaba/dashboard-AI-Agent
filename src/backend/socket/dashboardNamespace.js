import { logger } from '../utils/logger.js';
import { activeAgentWorkers } from '../metrics.js';
import { activeTerminalSessions } from './ptyNamespace.js';
import { safeQuery } from '../db.js';

/**
 * Registers worker/agent Socket.IO event handlers in the /dashboard namespace.
 *
 * @param {import('socket.io').Namespace} dashNsp  - the /dashboard namespace
 * @param {Map<string, object>} activeWorkers       - shared worker registry
 */
export function registerDashboardNamespace(dashNsp, activeWorkers) {
  dashNsp.on('connection', (socket) => {
    const isWorker = socket.handshake.auth?.isWorker;

    if (!isWorker) {
      // Regular browser dashboard client
      logger.info({ socketId: socket.id }, '/dashboard client connected');

      socket.on('subscribe', (room) => {
        if (typeof room === 'string' && room.trim()) {
          socket.join(room.trim());
          logger.debug({ socketId: socket.id, room }, 'Client subscribed to room');
        }
      });

      socket.on('unsubscribe', (room) => {
        if (typeof room === 'string' && room.trim()) {
          socket.leave(room.trim());
          logger.debug({ socketId: socket.id, room }, 'Client unsubscribed from room');
        }
      });

      socket.on('disconnect', () => {
        logger.info({ socketId: socket.id }, '/dashboard client disconnected');
      });
      return;
    }

    // Worker agent registration
    const workerInfo = {
      id: socket.id,
      name: socket.handshake.auth?.workerName || 'Local Worker',
      hostname: socket.handshake.auth?.hostname || 'unknown',
      platform: socket.handshake.auth?.platform || 'unknown',
      connectedAt: new Date().toISOString(),
      socket,
    };

    activeWorkers.set(socket.id, workerInfo);
    if (activeAgentWorkers && typeof activeAgentWorkers.set === 'function') {
      activeAgentWorkers.set(activeWorkers.size);
    }
    logger.info({ workerId: socket.id, name: workerInfo.name }, '🤖 Registered Local Agent Worker (/dashboard)');

    socket.on('register_worker', (data) => {
      const existing = activeWorkers.get(socket.id);
      if (existing) Object.assign(existing, data);
    });

    // Forward terminal stream from worker to PTY client
    socket.on('worker_terminal_data', ({ sessionId, data }) => {
      const ptyNsp = dashNsp.server.of('/pty');
      const clientSocket = ptyNsp?.sockets?.get(sessionId) || dashNsp.server.of('/')?.sockets?.get(sessionId);
      if (clientSocket) clientSocket.emit('terminal_data', data);
    });

    socket.on('worker_terminal_exit', ({ sessionId, exitCode, signal }) => {
      const ptyNsp = dashNsp.server.of('/pty');
      const clientSocket = ptyNsp?.sockets?.get(sessionId) || dashNsp.server.of('/')?.sockets?.get(sessionId);
      if (clientSocket) clientSocket.emit('terminal_exit', { exitCode, signal });

      const session = activeTerminalSessions.get(sessionId);
      if (session?.taskId) {
        const durationMs = Date.now() - session.sessionStartTime;
        safeQuery(
          'UPDATE agent_tasks SET status = $1, duration_ms = $2, updated_at = NOW() WHERE id = $3',
          [exitCode === 0 ? 'completed' : 'failed', durationMs, session.taskId]
        ).catch((err) => {
          logger.warn({ err: err.message }, 'Failed to update agent_tasks on worker exit');
        });
        activeTerminalSessions.delete(sessionId);
      }
    });

    socket.on('worker_terminal_error', ({ sessionId, message }) => {
      const ptyNsp = dashNsp.server.of('/pty');
      const clientSocket = ptyNsp?.sockets?.get(sessionId) || dashNsp.server.of('/')?.sockets?.get(sessionId);
      if (clientSocket) clientSocket.emit('terminal_error', message);

      const session = activeTerminalSessions.get(sessionId);
      if (session?.taskId) {
        const durationMs = Date.now() - session.sessionStartTime;
        safeQuery(
          'UPDATE agent_tasks SET status = $1, duration_ms = $2, updated_at = NOW() WHERE id = $3',
          ['failed', durationMs, session.taskId]
        ).catch(() => {});
        safeQuery(
          'INSERT INTO agent_logs (task_id, level, message) VALUES ($1, $2, $3)',
          [session.taskId, 'error', String(message)]
        ).catch(() => {});
        activeTerminalSessions.delete(sessionId);
      }
    });

    // Worker agent status and events
    socket.on('agent_status', (data) => {
      dashNsp.emit('agent_status', { workerId: socket.id, ...data });
    });

    socket.on('agent_event', (data) => {
      dashNsp.emit('agent_event', { workerId: socket.id, ...data });
    });

    socket.on('disconnect', () => {
      activeWorkers.delete(socket.id);
      if (activeAgentWorkers && typeof activeAgentWorkers.set === 'function') {
        activeAgentWorkers.set(activeWorkers.size);
      }
      logger.info({ workerId: socket.id }, '🤖 Unregistered Local Agent Worker (/dashboard)');
    });
  });
}

/**
 * Broadcasts a dashboard notification to all connected clients on /dashboard
 * @param {import('socket.io').Namespace} dashNsp
 * @param {object} notification
 */
export function emitDashboardNotification(dashNsp, notification) {
  if (!dashNsp) return;
  dashNsp.emit('notification', {
    id: notification.id || `notif_${Date.now()}`,
    timestamp: new Date().toISOString(),
    ...notification,
  });
}

/**
 * Broadcasts an agent event to all connected clients on /dashboard
 * @param {import('socket.io').Namespace} dashNsp
 * @param {object} event
 */
export function emitAgentEvent(dashNsp, event) {
  if (!dashNsp) return;
  dashNsp.emit('agent_event', {
    timestamp: new Date().toISOString(),
    ...event,
  });
}
