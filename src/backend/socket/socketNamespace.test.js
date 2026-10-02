import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { io as Client } from 'socket.io-client';
import express from 'express';
import { registerPtyNamespace } from './ptyNamespace.js';
import { registerDashboardNamespace, emitDashboardNotification, emitAgentEvent } from './dashboardNamespace.js';
import { createSocketAuthMiddleware } from './socketAuth.js';

describe('T2.2 — Socket.IO Namespace Isolation (/pty vs /dashboard)', () => {
  let httpServer;
  let io;
  let port;
  const TEST_SECRET = 'test-secret-token-key';
  const activeWorkers = new Map();

  beforeAll(async () => {
    const app = express();
    httpServer = createServer(app);
    io = new Server(httpServer, {
      cors: { origin: '*' },
    });

    const auth = createSocketAuthMiddleware(TEST_SECRET);
    io.use(auth);

    const ptyNsp = io.of('/pty');
    const dashNsp = io.of('/dashboard');

    ptyNsp.use(auth);
    dashNsp.use(auth);

    registerPtyNamespace(ptyNsp, activeWorkers);
    registerDashboardNamespace(dashNsp, activeWorkers);

    await new Promise((resolve) => {
      httpServer.listen(0, () => {
        port = httpServer.address().port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (io) io.close();
    if (httpServer) httpServer.close();
  });

  describe('Authentication Enforcement', () => {
    it('rejects connection to /pty without valid token', async () => {
      const socket = Client(`http://localhost:${port}/pty`, {
        auth: { token: 'invalid-token' },
        reconnection: false,
      });

      const err = await new Promise((resolve) => {
        socket.on('connect_error', (e) => resolve(e.message));
      });

      expect(err).toBe('Unauthorized');
      socket.close();
    });

    it('rejects connection to /dashboard without valid token', async () => {
      const socket = Client(`http://localhost:${port}/dashboard`, {
        auth: { token: 'invalid-token' },
        reconnection: false,
      });

      const err = await new Promise((resolve) => {
        socket.on('connect_error', (e) => resolve(e.message));
      });

      expect(err).toBe('Unauthorized');
      socket.close();
    });

    it('allows connection to both namespaces with valid secret', async () => {
      const ptySocket = Client(`http://localhost:${port}/pty`, {
        auth: { token: TEST_SECRET },
      });
      const dashSocket = Client(`http://localhost:${port}/dashboard`, {
        auth: { token: TEST_SECRET },
      });

      await Promise.all([
        new Promise((resolve) => ptySocket.on('connect', resolve)),
        new Promise((resolve) => dashSocket.on('connect', resolve)),
      ]);

      expect(ptySocket.connected).toBe(true);
      expect(dashSocket.connected).toBe(true);

      ptySocket.close();
      dashSocket.close();
    });
  });

  describe('Dashboard Notifications and Agent Events (/dashboard)', () => {
    it('broadcasts dashboard notifications only to /dashboard clients', async () => {
      const dashSocket = Client(`http://localhost:${port}/dashboard`, {
        auth: { token: TEST_SECRET },
      });
      const ptySocket = Client(`http://localhost:${port}/pty`, {
        auth: { token: TEST_SECRET },
      });

      await Promise.all([
        new Promise((resolve) => dashSocket.on('connect', resolve)),
        new Promise((resolve) => ptySocket.on('connect', resolve)),
      ]);

      const ptyNotificationSpy = vi.fn();
      ptySocket.on('notification', ptyNotificationSpy);

      const receivedNotifPromise = new Promise((resolve) => {
        dashSocket.on('notification', (data) => resolve(data));
      });

      const dashNsp = io.of('/dashboard');
      emitDashboardNotification(dashNsp, {
        id: 'alert_101',
        title: 'CPU Alert',
        message: 'CPU usage exceeded 90%',
      });

      const received = await receivedNotifPromise;
      expect(received.id).toBe('alert_101');
      expect(received.title).toBe('CPU Alert');

      // Verify notification did NOT leak to /pty
      expect(ptyNotificationSpy).not.toHaveBeenCalled();

      dashSocket.close();
      ptySocket.close();
    });

    it('broadcasts agent events only to /dashboard clients', async () => {
      const dashSocket = Client(`http://localhost:${port}/dashboard`, {
        auth: { token: TEST_SECRET },
      });

      await new Promise((resolve) => dashSocket.on('connect', resolve));

      const receivedEventPromise = new Promise((resolve) => {
        dashSocket.on('agent_event', (event) => resolve(event));
      });

      const dashNsp = io.of('/dashboard');
      emitAgentEvent(dashNsp, {
        agentId: 'agent_coder_1',
        event: 'task_started',
      });

      const received = await receivedEventPromise;
      expect(received.agentId).toBe('agent_coder_1');
      expect(received.event).toBe('task_started');

      dashSocket.close();
    });
  });

  describe('Worker Registration and Terminal Cross-Namespace Bridging', () => {
    it('registers worker on /dashboard and bridges terminal streams to /pty client', async () => {
      // 1. Worker connects to /dashboard
      const workerSocket = Client(`http://localhost:${port}/dashboard`, {
        auth: {
          token: TEST_SECRET,
          isWorker: true,
          workerName: 'Remote-Tester-Worker',
        },
      });

      await new Promise((resolve) => workerSocket.on('connect', resolve));
      expect(activeWorkers.size).toBe(1);

      // 2. Terminal client connects to /pty
      const ptyClient = Client(`http://localhost:${port}/pty`, {
        auth: { token: TEST_SECRET },
      });
      await new Promise((resolve) => ptyClient.on('connect', resolve));

      // 3. Worker listens for spawn request
      workerSocket.on('worker_spawn_pty', ({ sessionId }) => {
        // Worker sends terminal output back to /dashboard
        workerSocket.emit('worker_terminal_data', {
          sessionId,
          data: 'Process started successfully\r\n',
        });
        workerSocket.emit('worker_terminal_exit', {
          sessionId,
          exitCode: 0,
        });
      });

      const dataPromise = new Promise((resolve) => {
        ptyClient.on('terminal_data', (data) => resolve(data));
      });
      const exitPromise = new Promise((resolve) => {
        ptyClient.on('terminal_exit', (exit) => resolve(exit));
      });

      // 4. Client requests terminal spawn targeted to worker
      ptyClient.emit('spawn_terminal', {
        command: 'bash',
        executionTarget: 'worker',
      });

      const [data, exit] = await Promise.all([dataPromise, exitPromise]);

      expect(data).toBe('Process started successfully\r\n');
      expect(exit).toEqual({ exitCode: 0, signal: undefined });

      // Clean up
      ptyClient.close();
      workerSocket.close();
    });
  });
});
