/**
 * T7.3 — Prometheus Business Metrics
 * Centralised metric definitions for the dashboard backend.
 * Import `metricsMiddleware` into Express and use individual counters/histograms elsewhere.
 */
import client from 'prom-client';

export const register = new client.Registry();
client.collectDefaultMetrics({ register });

// ── HTTP request latency histogram ──────────────────────────────────────────
export const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
  registers: [register],
});

// ── HTTP request counter ─────────────────────────────────────────────────────
export const httpRequestTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

// ── HTTP error counter by status code ───────────────────────────────────────
export const httpErrorTotal = new client.Counter({
  name: 'http_errors_total',
  help: 'Total number of HTTP errors (4xx/5xx)',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

// ── Active agent worker count ────────────────────────────────────────────────
export const activeAgentWorkers = new client.Gauge({
  name: 'active_agent_workers',
  help: 'Number of currently active agent worker connections',
  registers: [register],
});

// ── Agent task counters ──────────────────────────────────────────────────────
export const agentTasksTotal = new client.Counter({
  name: 'agent_tasks_total',
  help: 'Total agent tasks dispatched',
  labelNames: ['status'],   // 'started' | 'completed' | 'failed'
  registers: [register],
});

// ── Express middleware that records request duration and counts ───────────────
export function metricsMiddleware(req, res, next) {
  const end = httpRequestDuration.startTimer();
  res.on('finish', () => {
    // Normalise dynamic segments for low-cardinality labels
    const route = req.route?.path ?? req.path.replace(/\/[0-9a-f-]{8,}/gi, '/:id') ?? 'unknown';
    const labels = { method: req.method, route, status_code: res.statusCode };
    end(labels);
    httpRequestTotal.inc(labels);
    if (res.statusCode >= 400) {
      httpErrorTotal.inc(labels);
    }
  });
  next();
}
