import { logger } from '../utils/logger.js';
import { activeAgentWorkers } from '../metrics.js';

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
      // Regular browser dashboard client — no persistent state needed here.
      logger.info({ socketId: socket.id }, '/dashboard client connected');
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
    activeAgentWorkers.set(activeWorkers.size);
    logger.info({ workerId: socket.id, name: workerInfo.name }, '🤖 Registered Local Agent Worker (/dashboard)');

    socket.on('register_worker', (data) => {
      const existing = activeWorkers.get(socket.id);
      if (existing) Object.assign(existing, data);
    });

    socket.on('worker_terminal_data', ({ sessionId, data }) => {
      // Forward to PTY client — look up in the /pty namespace
      const ptyNsp = dashNsp.server.of('/pty');
      const clientSocket = ptyNsp.sockets.get(sessionId);
      if (clientSocket) clientSocket.emit('terminal_data', data);
    });

    socket.on('worker_terminal_exit', ({ sessionId, exitCode, signal }) => {
      const ptyNsp = dashNsp.server.of('/pty');
      const clientSocket = ptyNsp.sockets.get(sessionId);
      if (clientSocket) clientSocket.emit('terminal_exit', { exitCode, signal });
    });

    socket.on('worker_terminal_error', ({ sessionId, message }) => {
      const ptyNsp = dashNsp.server.of('/pty');
      const clientSocket = ptyNsp.sockets.get(sessionId);
      if (clientSocket) clientSocket.emit('terminal_error', message);
    });

    socket.on('disconnect', () => {
      activeWorkers.delete(socket.id);
      activeAgentWorkers.set(activeWorkers.size);
      logger.info({ workerId: socket.id }, '🤖 Unregistered Local Agent Worker (/dashboard)');
    });
  });
}
