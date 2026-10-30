import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { KpiDashboardPanel } from './KpiDashboardPanel';

describe('KpiDashboardPanel', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders zero activity state with informative message', async () => {
    const mockZeroKpi = {
      today: { tasks: 0, successRate: 0, avgDuration: 0 },
      sevenDays: { tasks: 0, successRate: 0, avgDuration: 0 },
      thirtyDays: { tasks: 0, successRate: 0, avgDuration: 0 },
      topErrors: [],
      tokenBurn: { today: 0, week: 0 },
      sparkline: [
        { time: '6d', value: 0 },
        { time: '5d', value: 0 },
        { time: '4d', value: 0 },
        { time: '3d', value: 0 },
        { time: '2d', value: 0 },
        { time: '1d', value: 0 },
        { time: 'dziś', value: 0 },
      ],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockZeroKpi,
    } as unknown as Response);

    render(<KpiDashboardPanel />);

    await waitFor(() => {
      expect(screen.getByText(/Brak aktywności agentów w ostatnim okresie/i)).toBeDefined();
      expect(screen.getByText('Zadania dziś')).toBeDefined();
      expect(screen.getByText('Tokeny dziś')).toBeDefined();
    });
  });

  it('renders real telemetry metrics when tasks and tokens are recorded', async () => {
    const mockActiveKpi = {
      today: { tasks: 5, successRate: 100, avgDuration: 12.4 },
      sevenDays: { tasks: 22, successRate: 95.5, avgDuration: 14.1 },
      thirtyDays: { tasks: 80, successRate: 92.0, avgDuration: 15.0 },
      topErrors: [],
      tokenBurn: { today: 18450, week: 92300 },
      sparkline: [
        { time: '6d', value: 2 },
        { time: '5d', value: 4 },
        { time: '4d', value: 3 },
        { time: '3d', value: 5 },
        { time: '2d', value: 3 },
        { time: '1d', value: 0 },
        { time: 'dziś', value: 5 },
      ],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockActiveKpi,
    } as unknown as Response);

    render(<KpiDashboardPanel />);

    await waitFor(() => {
      expect(screen.getByText('18,450')).toBeDefined();
      expect(screen.getByText('100%')).toBeDefined();
      expect(screen.getByText('12.4s')).toBeDefined();
    });
  });

  it('renders error state on API failure', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    } as unknown as Response);

    render(<KpiDashboardPanel />);

    await waitFor(() => {
      expect(screen.getByText(/HTTP 500/i)).toBeDefined();
    });
  });
});
