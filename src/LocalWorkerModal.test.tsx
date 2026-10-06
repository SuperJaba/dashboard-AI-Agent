import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LocalWorkerModal } from './LocalWorkerModal';

describe('LocalWorkerModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (url.includes('/api/socket-info')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            serverUrl: 'http://localhost:3001',
            token: 'test-mock-jwt-token-12345',
            workers: [
              { id: 'w1', name: 'Workstation-1', platform: 'linux', type: 'local', hostname: 'my-pc', ip: '127.0.0.1' },
              { id: 'w2', name: 'omv', platform: 'linux', type: 'remote', serverName: 'OMV', serverId: 1, hostname: 'omv', ip: '10.10.10.100' }
            ]
          })
        });
      }
      if (url.includes('/api/agents/workers/w1') && opts?.method === 'DELETE') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, message: 'Worker Workstation-1 ubity' })
        });
      }
      if (url.includes('/api/agents/workers') && opts?.method === 'DELETE') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, message: 'Wszystkie sockety ubite' })
        });
      }
      if (url.includes('/api/servers/1/kill-tunnel') && opts?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, message: 'Tunel na serwerze OMV ubity przez SSH' })
        });
      }
      if (url.includes('/api/agents/workers')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([])
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({})
      });
    });
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(<LocalWorkerModal isOpen={false} onClose={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders title, current socket token and connection commands when open', async () => {
    await act(async () => {
      render(<LocalWorkerModal isOpen={true} onClose={() => {}} token="custom-token-xyz" />);
    });

    expect(screen.getByText(/Połączenie Socket & Local Worker/i)).toBeInTheDocument();
    expect(screen.getByText(/Aktualny Token do Socketu/i)).toBeInTheDocument();
    expect(screen.getByText(/Komenda do połączenia Socket:/i)).toBeInTheDocument();

    // Verify token is displayed in input
    const tokenInput = screen.getByLabelText('Aktualny token do socketu') as HTMLInputElement;
    expect(tokenInput).toBeInTheDocument();
    expect(tokenInput.value).toBe('custom-token-xyz');

    // Switch command tab to Node
    const nodeTab = screen.getByRole('button', { name: /Node Skrypt/i });
    await act(async () => {
      fireEvent.click(nodeTab);
    });
    expect(screen.getByText(/node scripts\/local-agent-worker\.js/i)).toBeInTheDocument();
  });

  it('renders workers with proper classification badges (Local PC vs Zdalny OMV)', async () => {
    await act(async () => {
      render(<LocalWorkerModal isOpen={true} onClose={() => {}} token="custom-token-xyz" />);
    });

    // Check classification badges
    expect(screen.getByText(/💻 Lokalny \(PC\)/i)).toBeInTheDocument();
    expect(screen.getByText(/🌐 Zdalny \(Serwer: OMV\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Workstation-1/i)).toBeInTheDocument();
    expect(screen.getAllByText('omv').length).toBeGreaterThan(0);
  });

  it('handles killing a single socket worker', async () => {
    await act(async () => {
      render(<LocalWorkerModal isOpen={true} onClose={() => {}} token="custom-token-xyz" />);
    });

    const killButtons = screen.getAllByRole('button', { name: /Ubij socket/i });
    expect(killButtons.length).toBe(2);

    await act(async () => {
      fireEvent.click(killButtons[0]);
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/agents/workers/w1'),
      expect.objectContaining({ method: 'DELETE' })
    );
  });

  it('handles killing all socket workers', async () => {
    await act(async () => {
      render(<LocalWorkerModal isOpen={true} onClose={() => {}} token="custom-token-xyz" />);
    });

    const killAllBtn = screen.getByRole('button', { name: /Ubij wszystkie sockety/i });
    expect(killAllBtn).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(killAllBtn);
    });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/agents/workers',
      expect.objectContaining({ method: 'DELETE' })
    );
  });

  it('handles killing remote worker tunnel via SSH', async () => {
    await act(async () => {
      render(<LocalWorkerModal isOpen={true} onClose={() => {}} token="custom-token-xyz" />);
    });

    const sshKillBtn = screen.getByRole('button', { name: /Ubij na serwerze \(SSH\)/i });
    expect(sshKillBtn).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(sshKillBtn);
    });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/servers/1/kill-tunnel',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('allows copying token and commands', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock }
    });

    await act(async () => {
      render(<LocalWorkerModal isOpen={true} onClose={() => {}} token="copyable-token-abc" />);
    });

    const copyTokenBtn = screen.getByRole('button', { name: /Kopiuj token/i });
    await act(async () => {
      fireEvent.click(copyTokenBtn);
    });
    expect(writeTextMock).toHaveBeenCalledWith('copyable-token-abc');

    const copyCmdBtn = screen.getByRole('button', { name: /Kopiuj wybraną komendę do schowka/i });
    await act(async () => {
      fireEvent.click(copyCmdBtn);
    });
    expect(writeTextMock).toHaveBeenCalled();
  });
});
