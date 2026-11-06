import jwt from 'jsonwebtoken';
import { JWT_SECRET } from './jwtSecret.js';

/**
 * Middleware requiring admin role
 */
export const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Dostęp tylko dla administratora' });
  }
  next();
};

/**
 * Basic authentication middleware
 */
export const authMiddleware = (req, res, next) => {
  // Allow OPTIONS requests for CORS
  if (req.method === 'OPTIONS') return next();

  // Allow CLI agents and scripts to synchronize tasks, manage project tasks, record model routing, and call proxy without requiring a user JWT
  const url = req.originalUrl || req.url || '';
  if (
    (req.method === 'POST' && /\/projects(\/[^/]+)?\/sync-tasks(\/|\?|$)/.test(url)) ||
    (req.method === 'POST' && /\/projects(\/[^/]+)\/(tasks|analyze)(\/|\?|$)/.test(url)) ||
    ((req.method === 'GET' || req.method === 'HEAD') && /\/projects(\/[^/]+)?(\/|\?|$)/.test(url)) ||
    ((req.method === 'PUT' || req.method === 'PATCH') && /\/projects(\/[^/]+)(\/|\?|$)/.test(url)) ||
    ((req.method === 'POST' || req.method === 'GET') && /\/llm\/(record-call|route-prompt|routing(-stats|\/stats))(\/|\?|$)/.test(url)) ||
    /\/llm-proxy(\/|\?|$)/.test(url)
  ) {
    return optionalAuthMiddleware(req, res, next);
  }

  let token;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.headers && req.headers['x-agent-token']) {
    token = req.headers['x-agent-token'];
  } else if (req.query && req.query.token) {
    // Native browser EventSource cannot send custom HTTP headers; allow query token only for SSE endpoints
    const isSse = url.includes('/events') || req.headers?.accept === 'text/event-stream';
    if (isSse) {
      token = req.query.token;
    } else {
      // Allow scoped CLI agent or worker tokens passed via ?token= without weakening SEC-08 for user sessions
      try {
        const peek = jwt.verify(req.query.token, JWT_SECRET);
        if (peek?.isAgent || peek?.isWorker) {
          token = req.query.token;
        }
      } catch {}
    }
  }

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

/**
 * Optional authentication middleware
 */
export const optionalAuthMiddleware = (req, res, next) => {
  if (req.method === 'OPTIONS') return next();

  const url = req.originalUrl || req.url || '';
  let token;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.headers && req.headers['x-agent-token']) {
    token = req.headers['x-agent-token'];
  } else if (req.query && req.query.token) {
    // Native browser EventSource cannot send custom HTTP headers; allow query token only for SSE endpoints
    const isSse = url.includes('/events') || req.headers?.accept === 'text/event-stream';
    if (isSse) {
      token = req.query.token;
    } else {
      try {
        const peek = jwt.verify(req.query.token, JWT_SECRET);
        if (peek?.isAgent || peek?.isWorker) {
          token = req.query.token;
        }
      } catch {}
    }
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
    } catch {}
  }

  next();
};

