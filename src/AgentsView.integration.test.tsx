import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from '@testing-library/react';
import { apiFetch } from './shared/api-client';

// Mock the API client **before** importing the component.
vi.mock('./shared/api-client', () => ({
  apiFetch: vi.fn((url: string, options?: any) => {
    const json = (data: unknown) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(data) });

    if (url === '/api/agents' && (!options || options.method === 'GET')) {
      return json([
        { id: 1, name: 'Agent One', description: '', path: '/usr/bin/a', config_uri: '', llm_model: 'gpt-4o', temperature: 0.7, max_tokens: 2048, installed: true },
      ]);
    }

    if (url === '/api/agents' && options?.method === 'POST') {
      return json({ success: true });
    }

    // DELETE /api/agents/:id
    const deleteMatch = new RegExp('^/api/agents/(\\d+)$', 'i').test(url);
    if (deleteMatch && options?.method === 'DELETE') {
      return json({ success: true });
    }

    // POST /api/agents/:id/tune
    const tuneMatch = new RegExp('^/api/agents/(\\d+)/tune$', 'i').test(url);
    if (tuneMatch) {
      return json({ success: true, testStatus: 'passed', agent: { name: 'Agent One' } });
    }

    // PUT /api/agents/:id for config updates
    const putMatch = new RegExp('^/api/agents/(\\d+)$', 'i').test(url);
    if (putMatch && options?.method === 'PUT') {
      return json({ success: true });
    }

    // Default stub
    return json({});
  }),
}));

// Import component after mocking
import { AgentsView } from './AgentsView';

describe('AgentsView integration tests', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders agent list and basic UI elements', async () => {
    render(<AgentsView />);
    await waitFor(() => expect(screen.getByText(/Agent One/i)).toBeInTheDocument());
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('adds a new agent via modal', async () => {
    render(<AgentsView />);
    await waitFor(() => expect(screen.getByText(/Agent One/i)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /dodaj agenta/i }));
    await waitFor(() => screen.getByText(/Dodaj Nowego Agenta/i));

    const nameInput = screen.getByPlaceholderText('np. Code Reviewer');
    fireEvent.change(nameInput, { target: { value: 'New Agent' } });
    const pathInput = screen.getByPlaceholderText('np. /usr/local/bin/agent');
    fireEvent.change(pathInput, { target: { value: '/tmp/new-agent' } });

    // Find modal overlay and submit button inside it
    const modalOverlay = screen.getByText(/Dodaj Nowego Agenta/i).closest('.modal-overlay') as HTMLElement;
    const submitBtn = within(modalOverlay!).getByRole('button', { name: /dodaj agenta/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.queryByText(/Dodaj Nowego Agenta/i)).not.toBeInTheDocument();
      const mockApi = vi.mocked(apiFetch);
      expect(mockApi).toHaveBeenCalledWith('/api/agents', expect.objectContaining({ method: 'POST' }));
    });
  });

  it('deletes an agent when delete button clicked', async () => {
    render(<AgentsView />);
    await waitFor(() => screen.getByText(/Agent One/i));
    const deleteBtn = screen.getAllByRole('button').find((btn) => btn.title === 'Usuń') as HTMLElement;
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(deleteBtn!);

    await waitFor(() => {
      const mockApi = vi.mocked(apiFetch);
      expect(mockApi).toHaveBeenCalledWith('/api/agents/1', { method: 'DELETE' });
    });
  });

  it('auto-tunes an agent and triggers server call', async () => {
    render(<AgentsView />);
    await waitFor(() => screen.getByText(/Agent One/i));
    const tuneBtn = screen.getAllByRole('button').find((btn) => btn.title === 'Auto-Tune Agent Parameters') as HTMLElement;
    fireEvent.click(tuneBtn!);

    await waitFor(() => {
      const mockApi = vi.mocked(apiFetch);
      expect(mockApi).toHaveBeenCalledWith('/api/agents/1/tune', { method: 'POST' });
    });
  });

  it('edits an agent configuration and saves changes', async () => {
    render(<AgentsView />);
    await waitFor(() => screen.getByText(/Agent One/i));
    const editBtn = screen.getAllByRole('button').find((btn) => btn.title === 'Edytuj') as HTMLElement;
    fireEvent.click(editBtn!);

    // Change config URI
    const uriInput = screen.getByPlaceholderText('np. ~/.agent.json') as HTMLInputElement;
    expect(uriInput).toBeVisible();
    fireEvent.change(uriInput, { target: { value: '/tmp/new-config' } });

    // Save changes
    const saveBtn = screen.getAllByRole('button').find((btn) => btn.title === 'Zapisz') as HTMLElement;
    fireEvent.click(saveBtn!);

    await waitFor(() => {
      const mockApi = vi.mocked(apiFetch);
      expect(mockApi).toHaveBeenCalledWith('/api/agents/1', expect.objectContaining({ method: 'PUT' }));
    });
  });
});
