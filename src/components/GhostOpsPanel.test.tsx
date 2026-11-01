import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GhostOpsPanel } from './GhostOpsPanel';
import { apiClient } from '../shared/api-client';

vi.mock('../shared/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe('GhostOpsPanel Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders title and empty state when no history exists', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ history: [] });

    render(<GhostOpsPanel />);

    expect(
      screen.getByText(/Ghost Ops — Nocny Autonomiczny Demon Samonaprawiający/i)
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith('/api/ghostops/history');
    });

    expect(screen.getByText(/Brak zarejestrowanych nocnych przebiegów/i)).toBeInTheDocument();
  });

  it('renders historical runs with badges and PR links', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      history: [
        {
          runId: 101,
          workflowName: 'CI / Test & Lint',
          headSha: 'abc1234',
          branchName: 'ghostops/fix-101',
          status: 'success',
          prUrl: 'https://github.com/my-org/my-repo/pull/15',
          prNumber: 15,
          timestamp: '2026-11-01T02:00:00.000Z',
        },
        {
          runId: 102,
          workflowName: 'Nightly E2E',
          headSha: 'def5678',
          branchName: 'ghostops/fix-102',
          status: 'error',
          error: 'Out of quota',
          prUrl: null,
          prNumber: null,
          timestamp: '2026-11-01T02:05:00.000Z',
        },
      ],
    });

    render(<GhostOpsPanel />);

    await waitFor(() => {
      expect(screen.getByText('CI / Test & Lint')).toBeInTheDocument();
      expect(screen.getByText('Nightly E2E')).toBeInTheDocument();
    });

    expect(screen.getByText(/Sukces/i)).toBeInTheDocument();
    expect(screen.getByText(/Błąd/i)).toBeInTheDocument();

    const prLink = screen.getByRole('link', { name: /PR #15/i });
    expect(prLink).toHaveAttribute('href', 'https://github.com/my-org/my-repo/pull/15');
    expect(prLink).toHaveAttribute('target', '_blank');
  });

  it('executes manual cycle when "Uruchom teraz" is clicked and updates view', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ history: [] });
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      success: true,
      totalFailures: 1,
      processed: 1,
      successful: 1,
      failed: 0,
      runs: [
        {
          runId: 202,
          workflowName: 'Integration Tests',
          headSha: 'ghi9012',
          branchName: 'ghostops/fix-202',
          status: 'success',
          prUrl: 'https://github.com/my-org/my-repo/pull/99',
          prNumber: 99,
          timestamp: '2026-11-01T03:00:00.000Z',
        },
      ],
    });

    render(<GhostOpsPanel />);

    const runButton = screen.getByRole('button', { name: /uruchom teraz/i });
    expect(runButton).toBeInTheDocument();

    fireEvent.click(runButton);

    expect(apiClient.post).toHaveBeenCalledWith('/api/ghostops/run', { hoursBack: 24 });

    await waitFor(() => {
      expect(screen.getByText('Integration Tests')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /PR #99/i })).toBeInTheDocument();
    });
  });

  it('displays error feedback if manual execution fails', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ history: [] });
    vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('Serwer niedostępny'));

    render(<GhostOpsPanel />);

    const runButton = screen.getByRole('button', { name: /uruchom teraz/i });
    fireEvent.click(runButton);

    await waitFor(() => {
      expect(screen.getByText(/Błąd wykonania: Serwer niedostępny/i)).toBeInTheDocument();
    });
  });
});
