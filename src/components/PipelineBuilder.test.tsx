import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PipelineBuilder } from './PipelineBuilder';
import { apiClient } from '../shared/api-client';

vi.mock('../shared/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('PipelineBuilder', () => {
  const samplePipelines = [
    {
      id: 'pipe-1',
      name: 'Sztafeta Deweloperska AI',
      description: 'Architekt ➔ Coder ➔ Reviewer ➔ QA',
      status: 'idle',
      steps: [
        { id: 's1', name: 'Specyfikacja Architekta', agent: 'claude', role: 'Architekt', prompt: 'Przygotuj specyfikację' },
        { id: 's2', name: 'Implementacja Kodu', agent: 'gemini', role: 'Programista', dependsOn: ['s1'], prompt: 'Napisz kod' },
        { id: 's3', name: 'Weryfikacja QA', agent: 'qwen', role: 'Tester', dependsOn: ['s2'], requireApproval: true, prompt: 'Uruchom testy' }
      ]
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient.get).mockResolvedValue(samplePipelines);
  });

  it('renders pipeline list and DAG stage cards', async () => {
    render(<PipelineBuilder />);

    await waitFor(() => {
      expect(screen.getAllByText('Sztafeta Deweloperska AI').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Specyfikacja Architekta')).toBeInTheDocument();
      expect(screen.getByText('Implementacja Kodu')).toBeInTheDocument();
      expect(screen.getByText('Weryfikacja QA')).toBeInTheDocument();
    });
  });

  it('triggers pipeline run on clicking "Uruchom potok"', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ runId: 'run-123', status: 'queued' });

    render(<PipelineBuilder />);

    await waitFor(() => {
      expect(screen.getAllByText('Sztafeta Deweloperska AI').length).toBeGreaterThanOrEqual(1);
    });

    const runButton = screen.getByRole('button', { name: /uruchom potok/i });
    fireEvent.click(runButton);

    expect(apiClient.post).toHaveBeenCalledWith('/api/pipelines/pipe-1/run');
  });

  it('approves paused step when awaiting approval', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ approved: true });

    render(<PipelineBuilder initialRun={{
      id: 'run-123',
      pipelineId: 'pipe-1',
      status: 'paused',
      awaitingStepId: 's3'
    }} />);

    await waitFor(() => {
      expect(screen.getByText(/wymaga zatwierdzenia/i)).toBeInTheDocument();
    });

    const approveButton = screen.getByRole('button', { name: /zatwierdź krok/i });
    fireEvent.click(approveButton);

    expect(apiClient.post).toHaveBeenCalledWith('/api/pipelines/pipe-1/runs/run-123/approve', {
      stepId: 's3'
    });
  });

  it('aborts active run on clicking "Przerwij potok"', async () => {
    vi.mocked(apiClient.delete).mockResolvedValueOnce({ aborted: true });

    render(<PipelineBuilder initialRun={{
      id: 'run-123',
      pipelineId: 'pipe-1',
      status: 'running'
    }} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /przerwij potok/i })).toBeInTheDocument();
    });

    const abortButton = screen.getByRole('button', { name: /przerwij potok/i });
    fireEvent.click(abortButton);

    expect(apiClient.delete).toHaveBeenCalledWith('/api/pipelines/pipe-1/runs/run-123');
  });

  it('creates default pipeline template when clicking "Załaduj szablon Sztafety"', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      id: 'pipe-new',
      name: 'Pełna Sztafeta Agentów',
      steps: []
    });

    render(<PipelineBuilder />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /załaduj szablon sztafety/i })).toBeInTheDocument();
    });

    const templateButton = screen.getByRole('button', { name: /załaduj szablon sztafety/i });
    fireEvent.click(templateButton);

    expect(apiClient.post).toHaveBeenCalledWith('/api/pipelines', expect.objectContaining({
      name: expect.stringContaining('Sztafeta')
    }));
  });
});
