import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { DeployCt8Widget } from './deploy-ct8-widget';
import { apiClient } from '../shared/api-client';

vi.mock('../shared/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('../hooks/useDashboardSocket', () => ({
  useDashboardSocket: () => ({
    socket: {
      on: vi.fn(),
      off: vi.fn(),
    },
  }),
}));

describe('DeployCt8Widget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders widget title and host correctly', async () => {
    vi.mocked(apiClient.get).mockImplementation(async (url: string) => {
      if (url === '/api/deploy/status') {
        return {
          state: 'IDLE',
          isDeploying: false,
          currentStep: 'Gotowy do wdrożenia',
          logs: [],
          lastDeploy: {
            status: 'SUCCESS',
            timestamp: new Date().toISOString(),
            durationSeconds: 45,
            targetHost: 'dashboard.jagger2.ct8.pl',
            error: null,
          },
          targetHost: 'dashboard.jagger2.ct8.pl',
        };
      }
      if (url === '/api/deploy/health') {
        return {
          healthy: true,
          statusCode: 200,
          latencyMs: 38,
          timestamp: new Date().toISOString(),
        };
      }
      return {};
    });

    render(<DeployCt8Widget />);

    expect(screen.getByText(/Wdrożenie CT8\.pl/i)).toBeInTheDocument();
    expect(screen.getByText('dashboard.jagger2.ct8.pl')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/Działa \(38 ms\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Pomyślny \(45s\)/i)).toBeInTheDocument();
    });
  });

  it('triggers deployment on button click when confirmed', async () => {
    vi.spyOn(window, 'confirm').mockImplementation(() => true);

    vi.mocked(apiClient.get).mockResolvedValue({
      state: 'IDLE',
      isDeploying: false,
      currentStep: 'Gotowy',
      logs: [],
      lastDeploy: { status: 'SUCCESS', timestamp: null, durationSeconds: 0, targetHost: '', error: null },
      targetHost: 'dashboard.jagger2.ct8.pl',
    });

    vi.mocked(apiClient.post).mockResolvedValue({
      success: true,
      message: 'Wdrożenie uruchomione',
    });

    render(<DeployCt8Widget />);

    const deployBtn = screen.getByRole('button', { name: /Wdróż na CT8/i });
    fireEvent.click(deployBtn);

    expect(window.confirm).toHaveBeenCalled();
    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/deploy/start',
        { environment: 'production', confirm: 'DEPLOY_CT8' },
        { headers: { 'x-admin-role': 'true', 'x-deploy-confirm': 'DEPLOY_CT8' } }
      );
    });
  });
});
