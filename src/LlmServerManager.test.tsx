import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LlmServerManager } from './LlmServerManager';

describe('LlmServerManager Component', () => {

vi.mock('./shared/api-client', () => ({
  apiFetch: vi.fn((url: string) => {
    if (url.includes('/api/llm-servers')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve([
          {
            id: 1,
            name: 'LM Studio Local',
            url: 'http://127.0.0.1:1337/v1',
            model: 'AtomicChat/qwen35-4b',
            provider: 'LM Studio',
            is_active: true
          },
          {
            id: 2,
            name: 'Ollama Remote',
            url: 'http://localhost:11434/v1',
            model: 'llama3:latest',
            provider: 'Ollama',
            is_active: false
          }
        ])
      });
    }
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({})
    });
  })
}));

  it('renders LLM Server selection dropdown with servers from DB', async () => {
    render(<LlmServerManager />);
    
    await waitFor(() => {
      expect(screen.getAllByText(/LM Studio Local/i).length).toBeGreaterThan(0);
    });

    const select = screen.getByRole('combobox', { name: /Wybierz serwer LLM/i });
    expect(select).toBeInTheDocument();
    expect(screen.getByText(/New LLM Server/i)).toBeInTheDocument();
    expect(screen.getByText(/Export/i)).toBeInTheDocument();
    expect(screen.getByText(/Import/i)).toBeInTheDocument();
  });

  it('opens modal when clicking "New LLM Server"', async () => {
    render(<LlmServerManager />);
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /New LLM Server/i })).toBeInTheDocument();
    });

    const newBtn = screen.getByText(/New LLM Server/i);
    fireEvent.click(newBtn);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Nowy Serwer LLM/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/LM Studio Local lub NVIDIA NIM/i)).toBeInTheDocument();
  });
});
