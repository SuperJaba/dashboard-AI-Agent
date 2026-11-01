import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { MobileApprovalsView } from './MobileApprovalsView';

describe('MobileApprovalsView', () => {
  const mockApprovals = [
    {
      id: 'app-1',
      action: 'deploy_to_prod',
      description: 'Wdrożenie na serwer produkcyjny CT8.pl',
      createdAt: '2026-11-01T04:00:00Z'
    },
    {
      id: 'app-2',
      action: 'pr_merge',
      description: 'Automatyczny merge PR #123 od Ghost Ops',
      createdAt: '2026-11-01T04:15:00Z'
    }
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders loading state initially and then lists pending approvals', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ approvals: mockApprovals })
    } as Response);

    render(<MobileApprovalsView />);

    await waitFor(() => {
      expect(screen.getByText(/Wdrożenie na serwer produkcyjny CT8.pl/i)).toBeInTheDocument();
      expect(screen.getByText(/Automatyczny merge PR #123 od Ghost Ops/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Oczekujące zgody \(2\)/i)).toBeInTheDocument();
  });

  it('handles approve action when clicking button', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ approvals: mockApprovals })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, approved: true })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ approvals: [mockApprovals[1]] })
      } as Response);

    render(<MobileApprovalsView />);

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /Zatwierdź/i })).toHaveLength(2);
    });

    const approveButtons = screen.getAllByRole('button', { name: /Zatwierdź/i });
    fireEvent.click(approveButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/Zatwierdzono pomyślnie/i)).toBeInTheDocument();
    });
  });

  it('handles reject action when clicking button', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ approvals: mockApprovals })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, approved: false })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ approvals: [mockApprovals[0]] })
      } as Response);

    render(<MobileApprovalsView />);

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /Odrzuć/i })).toHaveLength(2);
    });

    const rejectButtons = screen.getAllByRole('button', { name: /Odrzuć/i });
    fireEvent.click(rejectButtons[1]);

    await waitFor(() => {
      expect(screen.getByText(/Odrzucono akcję/i)).toBeInTheDocument();
    });
  });

  it('renders empty state when there are no approvals', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ approvals: [] })
    } as Response);

    render(<MobileApprovalsView />);

    await waitFor(() => {
      expect(screen.getByText(/Brak oczekujących zgód/i)).toBeInTheDocument();
    });
  });
});
