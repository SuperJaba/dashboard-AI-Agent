import os from 'os';

export function getLocalLanIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

export function resolveDashboardUrl(req) {
  const protocol = req?.headers?.['x-forwarded-proto'] || req?.protocol || 'http';
  const host = req?.headers?.['x-forwarded-host'] || (typeof req?.get === 'function' ? req.get('host') : '') || '';
  if (host && !host.includes('localhost') && !host.includes('127.0.0.1')) {
    return `${protocol}://${host}`;
  }
  const port = process.env.PORT || 3001;
  const lanIp = getLocalLanIp();
  return `http://${lanIp}:${port}`;
}
