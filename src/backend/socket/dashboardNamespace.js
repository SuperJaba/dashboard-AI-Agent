import { logger } from '../utils/logger.js';
import { activeAgentWorkers } from '../metrics.js';
import { classifyWorkerSocket } from './workerClassification.js';

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
    const classification = classifyWorkerSocket(socket);
    const workerInfo = {
      id: socket.id,
      name: socket.handshake.auth?.workerName || (classification.type === 'remote' ? 'Remote-Worker' : 'Local-Worker'),
      type: classification.type,
      ip: classification.ip,
      serverId: classification.serverId,
      serverName: classification.serverName,
      hostname: socket.handshake.auth?.hostname || 'unknown',
      platform: socket.handshake.auth?.platform || 'unknown',
      arch: socket.handshake.auth?.arch || 'unknown',
      connectedAt: new Date().toISOString(),
      socket,
    };

    activeWorkers.set(socket.id, workerInfo);
    if (activeAgentWorkers && typeof activeAgentWorkers.set === 'function') {
      activeAgentWorkers.set(activeWorkers.size);
    }
    logger.info({ workerId: socket.id, name: workerInfo.name, type: workerInfo.type, ip: workerInfo.ip }, '🤖 Registered Agent Worker (/dashboard)');

    socket.on('register_worker', (data) => {
      const existing = activeWorkers.get(socket.id);
      if (existing) {
        Object.assign(existing, data);
        if (data.type) existing.type = data.type;
        if (data.workerType) existing.type = data.workerType;
        if (data.serverId) existing.serverId = Number(data.serverId);
        if (data.serverName) existing.serverName = data.serverName;
        if (data.name?.toLowerCase().includes('omv') || data.hostname?.toLowerCase().includes('omv')) {
          existing.type = 'remote';
          if (!existing.serverName) existing.serverName = 'OMV';
        }
      }
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
    });

    socket.on('worker_terminal_error', ({ sessionId, message }) => {
      const ptyNsp = dashNsp.server.of('/pty');
      const clientSocket = ptyNsp?.sockets?.get(sessionId) || dashNsp.server.of('/')?.sockets?.get(sessionId);
      if (clientSocket) clientSocket.emit('terminal_error', message);
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
