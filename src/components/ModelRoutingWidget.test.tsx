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
      route: { tier: 'low', provider: 'lm-studio', model: 'openai/gpt-oss-20b' }
    });

    render(<ModelRoutingWidget />);

    const testLocalBtn = await screen.findByRole('button', { name: /Test Local/i });
    fireEvent.click(testLocalBtn);

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/llm/route-prompt',
        expect.objectContaining({ dryRun: true })
      );
    });

    expect(await screen.findByText(/Skierowano do: LM Studio/i)).toBeInTheDocument();
  });
});
