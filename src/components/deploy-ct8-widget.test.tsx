import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { DeployCt8Widget } from './deploy-ct8-widget';
import { cleanLogLine } from '../shared/clean-logs';
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
      if (url === '/api/deploy/targets') {
        return [
          { id: 'ct8', name: 'CT8.pl Production', host: 'dashboard.jagger2.ct8.pl', type: 'ct8', default: true },
          { id: 'omv', name: 'OMV (Home Server)', host: '10.10.10.100', type: 'omv', default: false },
        ];
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
        { environment: 'production', confirm: 'DEPLOY_CT8', targets: ['ct8'] },
        { headers: { 'x-admin-role': 'true', 'x-deploy-confirm': 'DEPLOY_CT8' } }
      );
    });
  });

  it('supports selecting multiple targets and deploying to them', async () => {
    vi.spyOn(window, 'confirm').mockImplementation(() => true);

    vi.mocked(apiClient.get).mockImplementation(async (url: string) => {
      if (url === '/api/deploy/targets') {
        return [
          { id: 'ct8', name: 'CT8.pl Production', host: 'dashboard.jagger2.ct8.pl', type: 'ct8', default: true },
          { id: 'omv', name: 'OMV (Home Server)', host: '10.10.10.100', type: 'omv', default: false },
        ];
      }
      return {
        state: 'IDLE',
        isDeploying: false,
        currentStep: 'Gotowy',
        logs: [],
        lastDeploy: { status: 'SUCCESS', timestamp: null, durationSeconds: 0, targetHost: '', error: null },
        targetHost: 'dashboard.jagger2.ct8.pl',
      };
    });

    vi.mocked(apiClient.post).mockResolvedValue({
      success: true,
      message: 'Wdrożenie uruchomione na cele: ct8, omv',
    });

    render(<DeployCt8Widget />);

    const omvTargetBtn = await screen.findByRole('button', { name: /OMV \(Home Server\)/i });
    fireEvent.click(omvTargetBtn);

    const multiDeployBtn = screen.getByRole('button', { name: /Wdróż na wybrane \(2\)/i });
    fireEvent.click(multiDeployBtn);

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/deploy/start',
        { environment: 'production', confirm: 'DEPLOY_CT8', targets: ['ct8', 'omv'] },
        { headers: { 'x-admin-role': 'true', 'x-deploy-confirm': 'DEPLOY_CT8' } }
      );
    });
  });

  it('notifies onDeployStateChange callback when deploying', async () => {
    const onDeployStateChange = vi.fn();
    vi.mocked(apiClient.get).mockResolvedValue({
      state: 'RUNNING',
      isDeploying: true,
      currentStep: 'Wdrażanie...',
      logs: [],
      lastDeploy: { status: 'SUCCESS', timestamp: null, durationSeconds: 0, targetHost: '', error: null },
      targetHost: 'dashboard.jagger2.ct8.pl',
    });

    render(<DeployCt8Widget onDeployStateChange={onDeployStateChange} />);

    await waitFor(() => {
      expect(onDeployStateChange).toHaveBeenCalledWith(true);
    });
  });

  it('cleanLogLine strips ANSI sequences and stray [0m', () => {
    expect(cleanLogLine('\u001b[32m[OK] Success\u001b[0m')).toBe('[OK] Success');
    expect(cleanLogLine('[0m')).toBe('');
    expect(cleanLogLine('ssh jagger2@s1.ct8.pl [0m')).toBe('ssh jagger2@s1.ct8.pl');
  });

  it('opens and closes redesigned logs console modal with target tabs', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      state: 'IDLE',
      isDeploying: false,
      currentStep: 'Gotowy',
      logs: [
        { timestamp: '12:00:00', text: 'Log testowy wdrożenia CT8', target: 'ct8' },
        { timestamp: '12:00:01', text: 'Log testowy wdrożenia OMV', target: 'omv' },
      ],
      lastDeploy: { status: 'SUCCESS', timestamp: null, durationSeconds: 0, targetHost: '', error: null },
      targetHost: 'dashboard.jagger2.ct8.pl',
    });

    render(<DeployCt8Widget />);

    const logsBtn = await screen.findByRole('button', { name: /Logi/i });
    fireEvent.click(logsBtn);

    expect(screen.getByText(/Konsola Wdrożenia CT8\.pl \/ Multi-Deploy/i)).toBeInTheDocument();
    expect(screen.getByText('Log testowy wdrożenia CT8')).toBeInTheDocument();
    expect(screen.getByText('Log testowy wdrożenia OMV')).toBeInTheDocument();

    // Check tabs
    expect(screen.getByRole('button', { name: /Wszystkie logi/i })).toBeInTheDocument();

    const closeBtn = screen.getByRole('button', { name: 'Zamknij' });
    fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByText(/Konsola Wdrożenia CT8\.pl \/ Multi-Deploy/i)).not.toBeInTheDocument();
    });
  });
});
