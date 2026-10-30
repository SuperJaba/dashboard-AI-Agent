import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { ServerStats } from './ServerStats';
import { apiClient } from './shared/api-client';

vi.mock('./shared/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe('ServerStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    vi.mocked(apiClient.get).mockReturnValue(new Promise(() => {})); // Never resolves
    render(<ServerStats serverId={1} />);
    expect(screen.getByText(/Ładowanie telemetryki serwera/i)).toBeInTheDocument();
  });

  it('renders error state when stats API returns error or empty', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ error: 'Server unreachable' });
    vi.mocked(apiClient.get).mockResolvedValueOnce({ apps: [] });

    render(<ServerStats serverId={1} />);
    await waitFor(() => {
      expect(screen.getByText(/Nie można pobrać statystyk serwera: Server unreachable/i)).toBeInTheDocument();
    });
  });

  it('renders telemetry pods and apps when data loads successfully', async () => {
    const mockStats = {
      cpu: {
        model: 'AMD Ryzen 9 5900X',
        cores: 12,
        load1: 1.45,
      },
      memory: {
        total: 34359738368, // 32 GB
        used: 17179869184,  // 16 GB
        usagePercent: 50.0,
      },
      os: {
        platform: 'linux',
        release: '6.5.0-generic',
        uptime: 7200, // 2 hours
      },
    };

    const mockApps = {
      apps: [
        {
          source: 'devil',
          domain: 'api.example.com',
          user: 'developer',
          type: 'nodejs',
          dir: '/home/developer/apps/api',
        },
        {
          source: 'process',
          pid: 4321,
          command: 'python server.py',
          cpu: 2.5,
          mem: 4.1,
          dir: '/home/developer/ai',
        },
      ],
    };

    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url.includes('system-stats')) return Promise.resolve(mockStats);
      if (url.includes('apps-scan')) return Promise.resolve(mockApps);
      return Promise.resolve({});
    });

    render(<ServerStats serverId={1} />);

    await waitFor(() => {
      expect(screen.getByText('CPU Usage')).toBeInTheDocument();
      expect(screen.getByText('Memory')).toBeInTheDocument();
      expect(screen.getByText('System Info')).toBeInTheDocument();
    });

    // Check CPU values
    expect(screen.getByText('12 Cores')).toBeInTheDocument();
    expect(screen.getByText('1.45')).toBeInTheDocument();

    // Check RAM values
    expect(screen.getByText('50.0%')).toBeInTheDocument();

    // Check Apps
    expect(screen.getByText('api.example.com')).toBeInTheDocument();
    expect(screen.getByText('PID: 4321')).toBeInTheDocument();
    expect(screen.getByText(/2 aktywnych/i)).toBeInTheDocument();
  });

  it('handles kill/restart button interaction with confirmation', async () => {
    const mockStats = {
      cpu: { model: 'Intel i7', cores: 8, load1: 0.5 },
      memory: { total: 16000000000, used: 8000000000, usagePercent: 50 },
      os: { platform: 'linux', release: '5.15', uptime: 3600 },
    };

    const mockApps = {
      apps: [
        {
          source: 'devil',
          domain: 'app.test.pl',
          user: 'testuser',
          type: 'node',
          pid: 9999,
        },
      ],
    };

    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url.includes('system-stats')) return Promise.resolve(mockStats);
      if (url.includes('apps-scan')) return Promise.resolve(mockApps);
      return Promise.resolve({});
    });
    vi.mocked(apiClient.post).mockResolvedValueOnce({ success: true });

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    render(<ServerStats serverId={2} />);

    await waitFor(() => {
      expect(screen.getByText('app.test.pl')).toBeInTheDocument();
    });

    const restartBtn = screen.getByRole('button', { name: /restart \/ kill/i });
    fireEvent.click(restartBtn);

    expect(confirmSpy).toHaveBeenCalled();
    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith('/api/kill-app', expect.objectContaining({
        serverId: 2,
        domain: 'app.test.pl',
        source: 'devil',
      }));
      expect(alertSpy).toHaveBeenCalledWith('Polecenie zostało wysłane');
    });
  });
});
