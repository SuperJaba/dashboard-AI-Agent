import { describe, it, expect } from 'vitest';
import os from 'os';
import { getLocalLanIp, resolveDashboardUrl } from './network.js';

// Spy on networkInterfaces before using it
const _originalNetworkInterfaces = os.networkInterfaces;
os.networkInterfaces = vi.fn();

describe('getLocalLanIp()', () => {
  it('should return IPv4 address when os.networkInterfaces() returns external interface with internal: false', async () => {
    // Mock network interfaces with external IPv4 interface
    os.networkInterfaces.mockReturnValue({
      'eth0': [
        {
          address: '192.168.1.100',
          family: 'IPv4',
          internal: false,
          mac: '00:00:00:00:00:01',
        },
      ],
    });

    const result = getLocalLanIp();

    expect(result).toBe('192.168.1.100');
  });

  it('should return fallback 127.0.0.1 when no external interfaces are found', async () => {
    // Mock empty network interfaces or only internal interfaces
    os.networkInterfaces.mockReturnValue({
      'lo': [
        {
          address: '127.0.0.1',
          family: 'IPv4',
          internal: true,
        },
      ],
    });

    const result = getLocalLanIp();

    expect(result).toBe('127.0.0.1');
  });

  it('should return fallback 127.0.0.1 when os.networkInterfaces() returns empty object', async () => {
    // Mock empty network interfaces
    os.networkInterfaces.mockReturnValue({});

    const result = getLocalLanIp();

    expect(result).toBe('127.0.0.1');
  });

  it('should return fallback 127.0.0.1 when only internal IPv4 interfaces exist', async () => {
    // Mock only internal interfaces
    os.networkInterfaces.mockReturnValue({
      'lo': [
        {
          address: '127.0.0.1',
          family: 'IPv4',
          internal: true,
        },
      ],
      'eth0': [
        {
          address: '192.168.1.100',
          family: 'IPv4',
          internal: true, // Internal interface only
        },
      ],
    });

    const result = getLocalLanIp();

    expect(result).toBe('127.0.0.1');
  });
});

describe('resolveDashboardUrl(req)', () => {
  it('should handle request with x-forwarded-proto https and x-forwarded-host mydomain.com', async () => {
    // Mock network interfaces first
    os.networkInterfaces.mockReturnValue({
      'eth0': [
        {
          address: '192.168.1.100',
          family: 'IPv4',
          internal: false,
          mac: '00:00:00:00:00:01',
        },
      ],
    });

    const req = {
      headers: {
        'x-forwarded-proto': 'https',
        'x-forwarded-host': 'mydomain.com',
      },
    };

    const result = resolveDashboardUrl(req);

    expect(result).toBe('https://mydomain.com');
  });

  it('should return URL based on getLocalLanIp() and process.env.PORT when host is localhost:5173', async () => {
    // Mock network interfaces first
    os.networkInterfaces.mockReturnValue({
      'eth0': [
        {
          address: '192.168.1.100',
          family: 'IPv4',
          internal: false,
          mac: '00:00:00:00:00:01',
        },
      ],
    });

    const req = {
      headers: {
        'x-forwarded-proto': 'http',
        'x-forwarded-host': 'localhost:5173',
      },
    };

    const result = resolveDashboardUrl(req);

    expect(result).toContain('192.168.1.100'); // LAN IP
    expect(result).toContain('3001'); // Default PORT from process.env.PORT || 3001
    expect(result).toBe('http://192.168.1.100:3001');
  });

  it('should return URL based on getLocalLanIp() and process.env.PORT when host is 127.0.0.1', async () => {
    // Mock network interfaces first
    os.networkInterfaces.mockReturnValue({
      'eth0': [
        {
          address: '192.168.1.100',
          family: 'IPv4',
          internal: false,
          mac: '00:00:00:00:00:01',
        },
      ],
    });

    const req = {
      headers: {
        'x-forwarded-proto': 'http',
        'x-forwarded-host': '127.0.0.1',
      },
    };

    const result = resolveDashboardUrl(req);

    expect(result).toContain('192.168.1.100'); // LAN IP
    expect(result).toContain('3001'); // Default PORT from process.env.PORT || 3001
    expect(result).toBe('http://192.168.1.100:3001');
  });

  it('should return default fallback with LAN IP when request is null', async () => {
    // Mock network interfaces first
    os.networkInterfaces.mockReturnValue({
      'eth0': [
        {
          address: '192.168.1.100',
          family: 'IPv4',
          internal: false,
          mac: '00:00:00:00:00:01',
        },
      ],
    });

    const result = resolveDashboardUrl(null);

    expect(result).toContain('192.168.1.100'); // LAN IP from getLocalLanIp()
    expect(result).toBe('http://192.168.1.100:3001');
  });

  it('should return default fallback with LAN IP when request is undefined', async () => {
    // Mock network interfaces first
    os.networkInterfaces.mockReturnValue({
      'eth0': [
        {
          address: '192.168.1.100',
          family: 'IPv4',
          internal: false,
          mac: '00:00:00:00:00:01',
        },
      ],
    });

    const result = resolveDashboardUrl(undefined);

    expect(result).toContain('192.168.1.100'); // LAN IP from getLocalLanIp()
    expect(result).toBe('http://192.168.1.100:3001');
  });

  it('should return URL with custom PORT when process.env.PORT is set', async () => {
    // Mock network interfaces first
    os.networkInterfaces.mockReturnValue({
      'eth0': [
        {
          address: '192.168.1.100',
          family: 'IPv4',
          internal: false,
          mac: '00:00:00:00:00:01',
        },
      ],
    });

    // Mock process.env.PORT directly
    const originalPort = process.env.PORT;
    process.env.PORT = '5000';

    const req = {
      headers: {
        'x-forwarded-proto': 'http',
        'x-forwarded-host': 'localhost:3001',
      },
    };

    const result = resolveDashboardUrl(req);

    expect(result).toBe('http://192.168.1.100:5000');

    // Restore original PORT
    process.env.PORT = originalPort;
  });
});
