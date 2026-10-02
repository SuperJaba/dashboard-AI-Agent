import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LocalWorkerModal } from './LocalWorkerModal';

describe('LocalWorkerModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/socket-info')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            serverUrl: 'http://localhost:3001',
            token: 'test-mock-jwt-token-12345',
            workers: [{ id: 'w1', name: 'Workstation-1', platform: 'linux' }]
          })
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

  it('allows copying token and commands', async () => {
    // Mock navigator.clipboard
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
