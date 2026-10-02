import pino from 'pino';

const isTest = process.env.NODE_ENV === 'test';
const isDev = process.env.NODE_ENV !== 'production';

/**
 * Structured JSON logger (T7.1).
 * - Silent in test environment to avoid polluting test output.
 * - Pretty-printed in development, raw JSON in production.
 */
export const logger = pino({
  level: isTest ? 'silent' : (process.env.LOG_LEVEL || 'info'),
  ...(isDev && !isTest
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
        },
      }
    : {}),
  base: { service: 'dashboard' },
  timestamp: pino.stdTimeFunctions.isoTime,
});

/**
 * Express request logger middleware.
 * Logs method, url, status, response time, and requestId (from X-Request-ID header).
 */
export function requestLogger(req, res, next) {
  if (isTest) return next();

  const start = Date.now();
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  req.requestId = requestId;

  res.on('finish', () => {
    const ms = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    logger[level]({ requestId, method: req.method, url: req.url, status: res.statusCode, ms });
  });

  next();
}
