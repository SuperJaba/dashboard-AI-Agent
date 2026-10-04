import pty from 'node-pty';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';

/**
 * Finds the best shell executable for the current platform.
 * @param {string|undefined} requestedCmd
 * @returns {string}
 */
export function findShellExecutable(requestedCmd) {
  if (requestedCmd && requestedCmd !== 'bash' && fs.existsSync(requestedCmd)) {
    return requestedCmd;
  }

  if (process.platform === 'win32') {
    const userHome = process.env.USERPROFILE || process.env.HOME || 'C:\\Users\\picho';
    const gitBashCandidates = [
      'C:\\Program Files\\Git\\bin\\bash.exe',
      'C:\\Program Files\\Git\\usr\\bin\\bash.exe',
      'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
      path.join(userHome, 'AppData', 'Local', 'Programs', 'Git', 'bin', 'bash.exe'),
    ];

    for (const bashPath of gitBashCandidates) {
      if (fs.existsSync(bashPath)) return bashPath;
    }
    return process.env.COMSPEC || 'cmd.exe';
  }

  return requestedCmd || 'bash';
}

/**
 * Registers PTY terminal socket.io event handlers in the /pty namespace.
 *
 * @param {import('socket.io').Namespace} ptyNsp  - the /pty namespace
 * @param {Map<string, object>} activeWorkers     - shared worker registry
 */
export function registerPtyNamespace(ptyNsp, activeWorkers) {
  ptyNsp.on('connection', (socket) => {
    logger.info({ socketId: socket.id }, '/pty client connected');

    let ptyProcess = null;
    let activeWorkerSocket = null;

    socket.on('spawn_terminal', ({ command, args, cwd, env, executionTarget, targetWorkerId, scriptContent }) => {
      let workerToUse = null;
      if (targetWorkerId && activeWorkers.has(targetWorkerId)) {
        workerToUse = activeWorkers.get(targetWorkerId);
      } else if (executionTarget === 'worker' || (executionTarget !== 'remote' && activeWorkers.size > 0)) {
        workerToUse = Array.from(activeWorkers.values())[0];
      }

      if (workerToUse) {
        activeWorkerSocket = workerToUse.socket;
        logger.info({ sessionId: socket.id, worker: workerToUse.name }, 'Forwarding PTY spawn to local worker');
        activeWorkerSocket.emit('worker_spawn_pty', {
          sessionId: socket.id,
          command,
          args,
          cwd,
          env,
          scriptContent,
        });
        return;
      }

      try {
        const shellCmd = findShellExecutable(command);
        const targetCwd = (cwd && fs.existsSync(cwd)) ? cwd : process.cwd();
        const userHome = process.env.USERPROFILE || process.env.HOME || 'C:\\Users\\picho';
        const extendedPath = process.platform === 'win32'
          ? [
            path.join(userHome, 'AppData\\Local\\agy\\bin'),
            path.join(userHome, 'AppData\\Local\\JetBrains\\Air\\node-24.13.0\\node-v24.13.0-win-x64'),
            path.join(userHome, 'AppData\\Local\\nvm\\v20.20.0'),
            'C:\\Program Files\\Git\\bin',
            'C:\\Program Files\\Git\\usr\\bin',
            process.env.PATH || '',
          ].join(';')
          : process.env.PATH;

        const sanitizedEnv = { ...(env || {}) };
        delete sanitizedEnv.HOME;
        delete sanitizedEnv.USER;
        delete sanitizedEnv.LOGNAME;
        delete sanitizedEnv.USERPROFILE;

        ptyProcess = pty.spawn(shellCmd, args || [], {
          name: 'xterm-256color',
          cols: 100,
          rows: 30,
          cwd: targetCwd,
          env: {
            ...process.env,
            ...sanitizedEnv,
            PATH: extendedPath,
            COLUMNS: '100',
            LINES: '30',
            TERM: 'xterm-256color',
          },
          useConpty: false,
        });

        ptyProcess.onData((data) => socket.emit('terminal_data', data));
        ptyProcess.onExit(({ exitCode, signal }) => socket.emit('terminal_exit', { exitCode, signal }));
      } catch (err) {
        logger.error({ err: err.message }, 'PTY spawn error');
        socket.emit('terminal_error', err.message);
      }
    });

    socket.on('terminal_input', (data) => {
      // Normalize Kitty keyboard protocol Enter sequences (\x1b[13;...u or [13;...u) to \r
      const cleanData = typeof data === 'string'
        ? data.replace(new RegExp(String.fromCharCode(27) + '\\[13;[0-9;]+u', 'g'), '\r').replace(/\[13;[0-9;]+u/g, '\r')
        : data;
      if (activeWorkerSocket) {
        activeWorkerSocket.emit('worker_terminal_input', { sessionId: socket.id, data: cleanData });
      } else if (ptyProcess) {
        try {
          ptyProcess.write(cleanData);
        } catch {}
      }
    });

    socket.on('terminal_resize', ({ cols, rows }) => {
      if (activeWorkerSocket) {
        activeWorkerSocket.emit('worker_terminal_resize', { sessionId: socket.id, cols, rows });
      } else if (ptyProcess) {
        try {
          ptyProcess.resize(cols, rows);
        } catch {}
      }
    });

    socket.on('disconnect', () => {
      if (activeWorkerSocket) {
        activeWorkerSocket.emit('worker_kill_pty', { sessionId: socket.id });
        activeWorkerSocket = null;
      }
      if (ptyProcess) {
        try {
          ptyProcess.kill();
        } catch {}
        ptyProcess = null;
      }
      logger.info({ socketId: socket.id }, '/pty client disconnected');
    });
  });
}
