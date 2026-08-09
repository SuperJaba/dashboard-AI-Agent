import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { io as Client } from 'socket.io-client';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

describe('Local Agent Worker WebSocket Daemon', () => {
  let io, httpServer, workerSocket, clientSocket;
  let port;
  const activeWorkers = new Map();

  beforeAll(async () => {
    const app = express();
    httpServer = createServer(app);
    io = new Server(httpServer, {
      cors: { origin: '*' }
    });

    io.use((socket, next) => {
      const token = socket.handshake.auth?.token;
      if (token === 'valid-secret-token') {
        return next();
      }
      return next(new Error('Unauthorized'));
    });

    io.on('connection', (socket) => {
      const isWorker = socket.handshake.auth?.isWorker;
      if (isWorker) {
        activeWorkers.set(socket.id, {
          id: socket.id,
          name: socket.handshake.auth?.workerName || 'Test-Worker',
          socket
        });

        socket.on('worker_terminal_data', ({ sessionId, data }) => {
          const client = io.sockets.sockets.get(sessionId);
          if (client) client.emit('terminal_data', data);
        });

        socket.on('worker_terminal_exit', ({ sessionId, exitCode }) => {
          const client = io.sockets.sockets.get(sessionId);
          if (client) client.emit('terminal_exit', { exitCode });
        });

        socket.on('disconnect', () => {
          activeWorkers.delete(socket.id);
        });
        return;
      }

      socket.on('spawn_terminal', ({ executionTarget }) => {
        let workerToUse = null;
        if (executionTarget === 'worker' && activeWorkers.size > 0) {
          workerToUse = Array.from(activeWorkers.values())[0];
        }

        if (workerToUse) {
          workerToUse.socket.emit('worker_spawn_pty', {
            sessionId: socket.id,
            command: 'echo "hello from worker"'
          });
        }
      });
    });

    await new Promise((resolve) => {
      httpServer.listen(0, () => {
        port = httpServer.address().port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (workerSocket) workerSocket.close();
    if (clientSocket) clientSocket.close();
    if (io) io.close();
    if (httpServer) httpServer.close();
  });

  it('should register a worker upon WSS connection', async () => {
    workerSocket = Client(`http://localhost:${port}`, {
      auth: {
        token: 'valid-secret-token',
        isWorker: true,
        workerName: 'Local-Laptop'
      }
    });

    await new Promise((resolve) => {
      workerSocket.on('connect', () => {
        expect(workerSocket.connected).toBe(true);
        expect(activeWorkers.size).toBe(1);
        const workerInfo = Array.from(activeWorkers.values())[0];
        expect(workerInfo.name).toBe('Local-Laptop');
        resolve();
      });
    });
  });

  it('should forward terminal spawn to local agent worker and receive output back', async () => {
    clientSocket = Client(`http://localhost:${port}`, {
      auth: { token: 'valid-secret-token' }
    });

    await new Promise((resolve) => {
      clientSocket.on('connect', () => {
        resolve();
      });
    });

    workerSocket.on('worker_spawn_pty', ({ sessionId }) => {
      workerSocket.emit('worker_terminal_data', { sessionId, data: 'Worker Executed Successfully\r\n' });
      workerSocket.emit('worker_terminal_exit', { sessionId, exitCode: 0 });
    });

    const receivedDataPromise = new Promise((resolve) => {
      clientSocket.on('terminal_data', (data) => {
        expect(data).toContain('Worker Executed Successfully');
        resolve();
      });
    });

    const exitPromise = new Promise((resolve) => {
      clientSocket.on('terminal_exit', ({ exitCode }) => {
        expect(exitCode).toBe(0);
        resolve();
      });
    });

    clientSocket.emit('spawn_terminal', { executionTarget: 'worker' });

    await Promise.all([receivedDataPromise, exitPromise]);
  });
});
