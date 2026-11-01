import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { AgentArenaButton } from './AgentArenaButton';

describe('AgentArenaButton', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders nothing if task is not completed', () => {
    const { container } = render(
      <AgentArenaButton
        task={{ id: 't1', status: 'running', prompt: 'test prompt' }}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders arena button when task is completed and opens agent selector on click', () => {
    render(
      <AgentArenaButton
        task={{ id: 't1', status: 'completed', prompt: 'test prompt' }}
      />
    );

    const button = screen.getByRole('button', { name: /Porównaj z innym agentem/i });
    expect(button).toBeInTheDocument();

    fireEvent.click(button);

    expect(screen.getByText(/Wybierz agenta do pojedynku/i)).toBeInTheDocument();
    expect(screen.getByText(/Claude 3.5 Sonnet/i)).toBeInTheDocument();
    expect(screen.getByText(/Gemini 1.5 Pro/i)).toBeInTheDocument();
  });

  it('triggers arena run on selecting an agent and opens diff viewer when done', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, runId: 'arena-run-123' })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ diff: '--- a/app.js\n+++ b/app.js\n+fixed' })
      } as Response);

    render(
      <AgentArenaButton
        task={{ id: 't1', status: 'completed', prompt: 'test prompt' }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Porównaj z innym agentem/i }));
    fireEvent.click(screen.getByText(/Gemini 1.5 Pro/i));

    await waitFor(() => {
      expect(screen.getByText(/Porównanie Wyników — Agent Arena/i)).toBeInTheDocument();
      expect(screen.getByText(/\+fixed/i)).toBeInTheDocument();
    });
  });
});
