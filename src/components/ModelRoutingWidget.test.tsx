import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { ModelRoutingWidget } from './ModelRoutingWidget';

describe('ModelRoutingWidget', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders with baseline stats initially', () => {
    render(<ModelRoutingWidget />);
    expect(screen.getByText(/Inteligentny Routing Modeli \(T5\)/i)).toBeDefined();
    expect(screen.getByText(/Tier Low \/ Medium \(Local\)/i)).toBeDefined();
    expect(screen.getByText(/Tier High \(Cloud \/ AGY\)/i)).toBeDefined();
    expect(screen.getByText(/Obwód: SPRAWNY \(CLOSED\)/i)).toBeDefined();
  });

  it('fetches dynamic stats from /api/llm/routing/stats on mount', async () => {
    const mockStats = {
      localTasks: 90,
      cloudTasks: 10,
      circuitBreakerState: 'CLOSED',
      primaryLocalModel: 'openai/gpt-oss-20b',
      fallbackLocalModel: 'granite-4.0-micro',
      cloudModel: 'AGY (Gemini Pro)',
      avgLocalLatencyMs: 310,
      avgCloudLatencyMs: 1200,
      localEndpoint: 'http://10.10.10.30:1234/v1',
      fallbackCount: 2,
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockStats,
    } as unknown as Response);

    render(<ModelRoutingWidget />);

    await waitFor(() => {
      expect(screen.getByText(/90%/i)).toBeDefined();
      expect(screen.getByText(/Śr. czas: ~310ms/i)).toBeDefined();
      expect(screen.getByText(/Śr. czas: ~1200ms/i)).toBeDefined();
    });
  });

  it('shows Reset button when circuit breaker is OPEN and allows reset', async () => {
    const openBreakerStats = {
      localTasks: 50,
      cloudTasks: 50,
      circuitBreakerState: 'OPEN',
      primaryLocalModel: 'openai/gpt-oss-20b',
      fallbackLocalModel: 'granite-4.0-micro',
      cloudModel: 'AGY (Gemini Pro)',
      avgLocalLatencyMs: 400,
      avgCloudLatencyMs: 1500,
      localEndpoint: 'http://10.10.10.30:1234/v1',
      fallbackCount: 5,
    };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => openBreakerStats,
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          stats: { ...openBreakerStats, circuitBreakerState: 'CLOSED' },
        }),
      } as unknown as Response);

    render(<ModelRoutingWidget />);

    await waitFor(() => {
      expect(screen.getByText(/ROZŁĄCZONY \(OPEN\)/i)).toBeDefined();
    });

    const resetBtn = screen.getByRole('button', { name: /Reset/i });
    expect(resetBtn).toBeDefined();

    fireEvent.click(resetBtn);

    await waitFor(() => {
      expect(screen.getByText(/Obwód: SPRAWNY \(CLOSED\)/i)).toBeDefined();
    });
  });

  it('renders 0% for both tiers when total tasks is 0', async () => {
    const zeroStats = {
      localTasks: 0,
      cloudTasks: 0,
      circuitBreakerState: 'CLOSED',
      primaryLocalModel: 'unsloth/Qwen3.5-4B-MTP-GGUF',
      fallbackLocalModel: 'granite-4.0-micro',
      cloudModel: 'AGY (Gemini Pro)',
      avgLocalLatencyMs: 0,
      avgCloudLatencyMs: 0,
      localEndpoint: 'http://10.10.10.30:8888/v1',
      fallbackCount: 0,
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => zeroStats,
    } as unknown as Response);

    render(<ModelRoutingWidget />);

    await waitFor(() => {
      expect(screen.getByText(/10.10.10.30:8888 \(LM Studio\)/i)).toBeDefined();
      expect(screen.queryByText(/100% \(0 zadań\)/i)).toBeNull();
      const zeroMatches = screen.getAllByText(/^0%/);
      expect(zeroMatches.length).toBe(2);
    });
  });

  it('renders cost savings meter and last routing ticker', () => {
    render(<ModelRoutingWidget />);
    expect(screen.getByText(/Oszczędności dzięki routingowi lokalnemu/i)).toBeInTheDocument();
    expect(screen.getByText(/Ostatni routing/i)).toBeInTheDocument();
  });
});
