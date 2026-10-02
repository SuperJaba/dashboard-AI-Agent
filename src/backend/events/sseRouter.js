import { Router } from 'express';
import { execFile } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SYS_INFO_SCRIPT = path.resolve(__dirname, '../../../../scripts/sys-info.js');
const MAX_CONNECTIONS = 50;

let connectionCount = 0;

/** @type {Set<import('http').ServerResponse>} */
const activeConnections = new Set();

/**
 * Runs `node scripts/sys-info.js --compact` and resolves with parsed JSON.
 * @returns {Promise<object>}
 */
function getSystemMetrics() {
  return new Promise((resolve, reject) => {
    execFile(process.execPath, [SYS_INFO_SCRIPT, '--compact'], { timeout: 4000 }, (err, stdout) => {
      if (err) return reject(err);
      try {
        resolve(JSON.parse(stdout.trim()));
      } catch (parseErr) {
        reject(parseErr);
      }
    });
  });
}

/**
 * Builds an SSE-formatted message string.
 * @param {string} eventName
 * @param {unknown} data
 * @returns {string}
 */
function formatSseEvent(eventName, data) {
  const payload = JSON.stringify(data);
  return `event: ${eventName}\ndata: ${payload}\n\n`;
}

/**
 * Determines which event names to emit for this connection.
 * @param {string|undefined} eventsParam - comma-separated event names from query string
 * @returns {Set<string>}
 */
function resolveEventFilter(eventsParam) {
  const all = new Set(['system-metrics', 'agent-status', 'heartbeat']);
  if (!eventsParam) return all;
  const requested = eventsParam.split(',').map(e => e.trim()).filter(Boolean);
  const filtered = new Set(requested.filter(e => all.has(e)));
  return filtered.size > 0 ? filtered : all;
}

export const sseRouter = Router();

sseRouter.get('/', (req, res) => {
  if (connectionCount >= MAX_CONNECTIONS) {
    logger.warn({ connectionCount }, 'SSE: max connections reached, rejecting');
    return res.status(503).json({ error: 'Zbyt wiele połączeń SSE. Spróbuj ponownie później.' });
  }

  connectionCount++;
  activeConnections.add(res);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const allowedEvents = resolveEventFilter(req.query.events);

  logger.info({ connectionCount, filter: [...allowedEvents] }, 'SSE: new client connected');

  const intervals = [];

  // system-metrics every 5 s
  if (allowedEvents.has('system-metrics')) {
    const metricsInterval = setInterval(async () => {
      try {
        const metrics = await getSystemMetrics();
        res.write(formatSseEvent('system-metrics', metrics));
      } catch (err) {
        logger.warn({ err: err.message }, 'SSE: failed to collect system metrics');
        res.write(formatSseEvent('system-metrics', { error: 'Nie udało się pobrać metryk' }));
      }
    }, 5000);
    intervals.push(metricsInterval);
  }

  // agent-status every 10 s
  if (allowedEvents.has('agent-status')) {
    // Lazy-import activeWorkers from server to avoid circular deps at module init.
    // We resolve the import once and cache the reference.
    let getWorkers = () => [];
    import('../../../../server.js').then(mod => {
      const map = mod.activeWorkers;
      getWorkers = () =>
        Array.from(map.values()).map(w => ({
          id: w.id,
          name: w.name,
          hostname: w.hostname,
          platform: w.platform,
          connectedAt: w.connectedAt,
        }));
    }).catch(() => {
      // In test environment server.js may not be available — getWorkers stays as () => []
    });

    const agentInterval = setInterval(() => {
      try {
        res.write(formatSseEvent('agent-status', { workers: getWorkers() }));
      } catch (err) {
        logger.warn({ err: err.message }, 'SSE: failed to emit agent-status');
      }
    }, 10000);
    intervals.push(agentInterval);
  }

  // heartbeat every 30 s
  if (allowedEvents.has('heartbeat')) {
    const heartbeatInterval = setInterval(() => {
      res.write(formatSseEvent('heartbeat', { ts: new Date().toISOString() }));
    }, 30000);
    intervals.push(heartbeatInterval);
  }

  // Initial heartbeat / connection confirmation
  res.write(formatSseEvent('heartbeat', { ts: new Date().toISOString() }));

  const cleanup = () => {
    intervals.forEach(clearInterval);
    connectionCount--;
    activeConnections.delete(res);
    logger.info({ connectionCount }, 'SSE: client disconnected');
  };

  req.on('close', cleanup);
  req.on('error', cleanup);
});
