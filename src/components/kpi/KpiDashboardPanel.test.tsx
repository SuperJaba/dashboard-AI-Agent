import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { KpiDashboardPanel } from './KpiDashboardPanel';

describe('KpiDashboardPanel', () => {
  const mockKpiResponse = {
    today: {
      tasks: 15,
      successRate: 92,
      avgDuration: 2.8,
    },
    sevenDays: {
      tasks: 85,
      successRate: 88,
      avgDuration: 3.1,
    },
    thirtyDays: {
      tasks: 320,
      successRate: 85,
      avgDuration: 3.4,
    },
    topErrors: [
      { error: 'Timeout', count: 3 },
    ],
    tokenBurn: {
      today: 12500,
      week: 89000,
    },
  };

  beforeEach(() => {
    localStorage.setItem('dashboard_token', 'test-bearer-token');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue(mockKpiResponse),
    }));
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('passes dashboard_token in Authorization header and displays token burn metrics', async () => {
    render(<KpiDashboardPanel />);

    await waitFor(() => {
      expect(screen.getByText('Tokeny dziś')).toBeDefined();
    });

    expect(fetch).toHaveBeenCalledWith('/api/analytics/kpi', {
      headers: {
        Authorization: 'Bearer test-bearer-token',
      },
    });

    expect(screen.getByText(/12.500/)).toBeDefined();
    expect(screen.getByText('Zadania dziś')).toBeDefined();
    expect(screen.getByText('92%')).toBeDefined();
  });
});
