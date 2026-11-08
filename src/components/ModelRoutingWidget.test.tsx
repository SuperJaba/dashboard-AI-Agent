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
    expect(screen.getByText(/Inteligentny Routing Modeli/i)).toBeDefined();
    expect(screen.getByText(/Tier Low \/ Medium/i)).toBeDefined();
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
      avgLocalLatencyMs: 350,
      avgCloudLatencyMs: 1400,
      localEndpoint: 'http://10.10.10.30:1234/v1',
      fallbackCount: 5,
    };

    const resetStats = {
      ...openBreakerStats,
      circuitBreakerState: 'CLOSED',
      fallbackCount: 0,
    };

    global.fetch = vi.fn().mockImplementation((url, opts) => {
      if (url === '/api/llm/routing/circuit/reset' && opts?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ success: true, stats: resetStats }),
        } as unknown as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => openBreakerStats,
      } as unknown as Response);
    });

    render(<ModelRoutingWidget />);

    await waitFor(() => {
      expect(screen.getByText(/Obwód: ROZŁĄCZONY \(OPEN\)/i)).toBeDefined();
      expect(screen.getByRole('button', { name: /Reset/i })).toBeDefined();
    });

    const resetBtn = screen.getByRole('button', { name: /Reset/i });
    fireEvent.click(resetBtn);

    await waitFor(() => {
      expect(screen.getByText(/Obwód: SPRAWNY \(CLOSED\)/i)).toBeDefined();
    });
  });

  it('allows triggering live test prompt simulation', async () => {
    const mockStats = {
      localTasks: 10,
      cloudTasks: 2,
      circuitBreakerState: 'CLOSED',
      primaryLocalModel: 'openai/gpt-oss-20b',
      fallbackLocalModel: 'granite-4.0-micro',
      cloudModel: 'AGY (Gemini Pro)',
      avgLocalLatencyMs: 300,
      avgCloudLatencyMs: 1200,
      localServerName: 'Unsloth',
    };

    global.fetch = vi.fn().mockImplementation((url, opts) => {
      if (url === '/api/llm/route-prompt' && opts?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            result: { durationMs: 280, model: 'unsloth/Qwen3.5-4B-MTP-GGUF', provider: 'lm-studio' },
            stats: mockStats,
          }),
        } as unknown as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => mockStats,
      } as unknown as Response);
    });

    render(<ModelRoutingWidget />);

    const testLocalBtn = await screen.findByRole('button', { name: /Test Local/i });
    fireEvent.click(testLocalBtn);

    expect(await screen.findByText(/Skierowano do: Unsloth \(Lokalny\)/i)).toBeDefined();
  });
});
