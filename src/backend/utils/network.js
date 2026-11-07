import os from 'os';

/**
 * Get the local LAN IP address by checking network interfaces.
 * Returns the first IPv4 address with external (non-internal) interface,
 * or falls back to 127.0.0.1 if no external interface found.
 */
export function getLocalLanIp() {
  const networks = os.networkInterfaces();

  // Filter for IPv4 addresses with external (non-internal) interface
  for (const [_name, info] of Object.entries(networks)) {
    for (const addr of info) {
      if (addr.family === 'IPv4' && !addr.internal) {
        return addr.address;
      }
    }
  }

  // Fallback to localhost
  return '127.0.0.1';
}

/**
 * Resolve the dashboard URL from a request object.
 * Handles forwarded headers (x-forwarded-proto, x-forwarded-host) for proxy scenarios.
 * For localhost requests, resolves using getLocalLanIp() and process.env.PORT.
 * Falls back to default LAN IP if request is null/undefined.
 *
 * @param {Request} req - Express request object
 * @returns {string} - Resolved dashboard URL
 */
export function resolveDashboardUrl(req) {
  // Fallback: use local LAN IP with default port
  const fallbackUrl = `http://${getLocalLanIp()}:${process.env.PORT || 3001}`;

  if (!req) {
    return fallbackUrl;
  }

  // Check for forwarded headers (proxy scenario)
  const proto = req.headers['x-forwarded-proto'] || 'http';
  const hostHeader = req.headers['x-forwarded-host'];

  // Use x-forwarded-host if available, otherwise fall back to getLocalLanIp() + port
  if (hostHeader) {
    const hostname = hostHeader.split(':')[0]; // Remove port from hostname if present

    // If it's localhost, resolve using LAN IP
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return `http://${getLocalLanIp()}:${process.env.PORT || 3001}`;
    }

    // Use the forwarded host as-is
    return `${proto}://${hostHeader}`;
  }

  // Default: use x-forwarded-proto with getLocalLanIp() and port
  return `${proto}://${getLocalLanIp()}:${process.env.PORT || 3001}`;
}
