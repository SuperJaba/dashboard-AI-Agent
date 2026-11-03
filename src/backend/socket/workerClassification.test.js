import { describe, it, expect } from 'vitest';
import { classifyWorkerSocket } from './workerClassification.js';
import jwt from 'jsonwebtoken';

describe('workerClassification', () => {
  const TEST_SECRET = 'test-secret-key-at-least-32-chars-long';

  it('classifies localhost/loopback socket as local by default', () => {
    const mockSocket = {
      handshake: {
        address: '127.0.0.1',
        auth: { workerName: 'Moj-PC' }
      }
    };
    const res = classifyWorkerSocket(mockSocket);
    expect(res.type).toBe('local');
    expect(res.ip).toBe('127.0.0.1');
  });

  it('classifies remote IP with different hostname as remote', () => {
    const mockSocket = {
      handshake: {
        address: '10.10.10.100',
        auth: { workerName: 'Remote-Node', hostname: 'omv-server' }
      }
    };
    const res = classifyWorkerSocket(mockSocket);
    expect(res.type).toBe('remote');
    expect(res.ip).toBe('10.10.10.100');
  });

  it('identifies OMV server from name or IP', () => {
    const mockSocket = {
      handshake: {
        address: '10.10.10.100',
        auth: { workerName: 'omv' }
      }
    };
    const res = classifyWorkerSocket(mockSocket);
    expect(res.type).toBe('remote');
    expect(res.serverName).toBe('OMV');
  });

  it('identifies serverId from JWT token payload as remote', () => {
    const token = jwt.sign({ serverId: 1, isWorker: true }, TEST_SECRET);
    const mockSocket = {
      handshake: {
        address: '127.0.0.1',
        auth: { token, workerName: 'Server-1-Worker' }
      }
    };
    const res = classifyWorkerSocket(mockSocket);
    expect(res.type).toBe('remote');
    expect(res.serverId).toBe(1);
  });

  it('matches against knownServers list', () => {
    const knownServers = [{ id: 1, name: 'OMV-Nas', host: '10.10.10.100' }];
    const mockSocket = {
      handshake: {
        address: '10.10.10.100',
        auth: { workerName: 'OMV-Nas' }
      }
    };
    const res = classifyWorkerSocket(mockSocket, knownServers);
    expect(res.type).toBe('remote');
    expect(res.serverName).toBe('OMV-Nas');
  });
});
