/**
 * Configures CORS whitelist for Express API and Socket.IO servers (SEC-06).
 */
export function getAllowedOrigins() {
  const envOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  const defaultOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3001',
    'http://127.0.0.1:3001',
    'https://dashboard.jagger2.ct8.pl',
    'http://dashboard.jagger2.ct8.pl'
  ];

  return Array.from(new Set([...defaultOrigins, ...envOrigins]));
}

/**
 * Dynamic CORS origin validator function for Express cors() and Socket.IO.
 * - Allows requests without an Origin header (same-origin, curl, server-to-server).
 * - Matches incoming origin against the configured domain whitelist.
 * - Rejects unauthorized origins by passing false (no Access-Control-Allow-Origin header).
 */
export function corsOriginDelegate(origin, callback) {
  if (!origin) {
    return callback(null, true);
  }

  // Allow wildcard only if explicitly specified in environment
  if (process.env.ALLOWED_ORIGINS === '*') {
    return callback(null, true);
  }

  const allowed = getAllowedOrigins();
  if (allowed.includes(origin)) {
    return callback(null, true);
  }

  // Origin not allowed
  return callback(null, false);
}

export const corsOptions = {
  origin: corsOriginDelegate,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  credentials: true
};
