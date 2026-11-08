import os from 'os';
import jwt from 'jsonwebtoken';

/**
 * Classifies a connecting worker socket into 'local' or 'remote',
 * and extracts metadata (IP, serverId, serverName).
 *
 * @param {import('socket.io').Socket} socket
 * @param {Array<{id: number, name: string, host: string}>} [knownServers] - optional list of known servers
 * @returns {{ type: 'local' | 'remote', ip: string, serverId: number | null, serverName: string | null }}
 */
export function classifyWorkerSocket(socket, knownServers = []) {
  let token = socket.handshake?.auth?.token;
  if (!token && socket.handshake?.headers?.authorization) {
    const parts = socket.handshake.headers.authorization.split(' ');
    token = parts.length === 2 ? parts[1] : parts[0];
  }

  let decoded = null;
  if (token) {
    try {
      decoded = jwt.decode(token);
    } catch {
      // Ignore invalid token decoding in classification
    }
  }

  const rawIp = (
    socket.handshake?.headers?.['x-forwarded-for']?.split(',')[0] ||
    socket.handshake?.address ||
    socket.conn?.remoteAddress ||
    ''
  ).replace(/^::ffff:/, '').trim();

  const isLoopback = rawIp === '127.0.0.1' || rawIp === '::1' || rawIp === 'localhost' || rawIp === '';
  const serverId = decoded?.serverId || socket.handshake?.auth?.serverId || null;
  const workerTypeAuth = socket.handshake?.auth?.workerType;
  const workerName = socket.handshake?.auth?.workerName || '';
  const hostname = socket.handshake?.auth?.hostname || '';

  let type = 'local';
  let serverName = null;

  // 1. Check against known servers
  if (Array.isArray(knownServers) && knownServers.length > 0) {
    const matched = knownServers.find(s => 
      (serverId && Number(s.id) === Number(serverId)) ||
      (rawIp && s.host === rawIp) ||
      (workerName && s.name && s.name.toLowerCase() === workerName.toLowerCase()) ||
      (hostname && s.host && s.host === hostname) ||
      (hostname && s.name && s.name.toLowerCase() === hostname.toLowerCase())
    );
    if (matched) {
      type = 'remote';
      serverName = matched.name;
    }
  }

  // 2. Explicit or heuristic classification
  if (workerTypeAuth === 'remote') {
    type = 'remote';
  } else if (workerTypeAuth === 'local') {
    type = 'local';
  } else if (serverId) {
    type = 'remote';
  } else if (!isLoopback && hostname && hostname !== os.hostname()) {
    type = 'remote';
  } else if (workerName.toLowerCase().includes('omv') || hostname.toLowerCase().includes('omv') || rawIp === '10.10.10.100') {
    type = 'remote';
  }

  if (!serverName && (workerName.toLowerCase().includes('omv') || hostname.toLowerCase().includes('omv') || rawIp === '10.10.10.100')) {
    serverName = 'OMV';
  }

  return {
    type,
    ip: rawIp || '127.0.0.1',
    serverId: serverId ? Number(serverId) : null,
    serverName
  };
}
