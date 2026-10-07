import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ModelRoutingWidget } from './ModelRoutingWidget';
import { apiClient } from '../shared/api-client';

vi.mock('../shared/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe('ModelRoutingWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders widget title, default metrics, and calls routing-stats API', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      localTasks: 42,
      cloudTasks: 8,
      circuitBreakerState: 'CLOSED',
      primaryLocalModel: 'openai/gpt-oss-20b',
      fallbackLocalModel: 'granite-4.0-micro',
      cloudModel: 'AGY (Gemini Pro)',
      avgLocalLatencyMs: 310,
      avgCloudLatencyMs: 1380,
    });

    render(<ModelRoutingWidget />);

    expect(screen.getByText(/Inteligentny Routing Modeli/i)).toBeInTheDocument();
    expect(screen.getByText(/Circuit: CLOSED/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith('/api/llm/routing-stats');
    });

    expect(await screen.findByText(/42 zadań/i)).toBeInTheDocument();
    expect(screen.getByText(/8 zadań/i)).toBeInTheDocument();
  });

  it('allows triggering live test prompt simulation', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      localTasks: 10,
      cloudTasks: 2,
      circuitBreakerState: 'CLOSED',
      primaryLocalModel: 'openai/gpt-oss-20b',
      fallbackLocalModel: 'granite-4.0-micro',
      cloudModel: 'AGY (Gemini Pro)',
      avgLocalLatencyMs: 300,
      avgCloudLatencyMs: 1200,
    });

    vi.mocked(apiClient.post).mockResolvedValue({
      success: true,
      result: { durationMs: 280, model: 'unsloth/Qwen3.5-4B-MTP-GGUF', provider: 'lm-studio' }
    });

    render(<ModelRoutingWidget />);

    const testLocalBtn = await screen.findByRole('button', { name: /Test Local/i });
    fireEvent.click(testLocalBtn);

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/llm/route-prompt',
        expect.objectContaining({ dryRun: false })
      );
    });

    expect(await screen.findByText(/Skierowano do: Unsloth/i)).toBeInTheDocument();
  });

  it('renders honest zero state with 0% and brak wywołań when no tasks have been executed', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      localTasks: 0,
      cloudTasks: 0,
      circuitBreakerState: 'CLOSED',
      primaryLocalModel: 'openai/gpt-oss-20b',
      fallbackLocalModel: 'granite-4.0-micro',
      cloudModel: 'AGY (Gemini Pro)',
      avgLocalLatencyMs: 0,
      avgCloudLatencyMs: 0,
    });

    render(<ModelRoutingWidget />);

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith('/api/llm/routing-stats');
    });

    expect(screen.getAllByText(/\(0 zadań\)/i)).toHaveLength(2);
    expect(screen.getByText(/Śr\. czas: brak wywołań \(0 zł\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Śr\. czas: brak wywołań$/i)).toBeInTheDocument();
  });
});
