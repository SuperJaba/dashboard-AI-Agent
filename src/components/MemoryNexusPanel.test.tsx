import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryNexusPanel } from './MemoryNexusPanel';
import { apiClient } from '../shared/api-client';

vi.mock('../shared/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('MemoryNexusPanel Component', () => {
  const mockMemories = [
    {
      id: 'mem-1',
      agent: 'claude-code',
      project: 'dashboard',
      category: 'database',
      content: 'Zawsze używaj safeQuery jako wrapper wokół pool.query.',
      tags: ['db', 'postgres'],
      created_at: '2026-11-01T04:00:00.000Z',
      access_count: 5,
    },
    {
      id: 'mem-2',
      agent: 'gemini',
      project: 'ecommerce',
      category: 'frontend',
      content: 'Tailwind CSS v4 korzysta z dyrektywy @theme w pliku app.css.',
      tags: ['css', 'tailwind'],
      created_at: '2026-11-01T04:30:00.000Z',
      access_count: 2,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders header, controls, and list of knowledge cards', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce(mockMemories);

    render(<MemoryNexusPanel />);

    expect(
      screen.getByText(/Baza Wiedzy Agentów \(Cross-Agent Memory Nexus\)/i)
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith('/api/memory', expect.anything());
    });

    expect(screen.getByText('Zawsze używaj safeQuery jako wrapper wokół pool.query.')).toBeInTheDocument();
    expect(screen.getByText('Tailwind CSS v4 korzysta z dyrektywy @theme w pliku app.css.')).toBeInTheDocument();
    expect(screen.getByText('claude-code')).toBeInTheDocument();
    expect(screen.getByText('database')).toBeInTheDocument();
    expect(screen.getByText('#db')).toBeInTheDocument();
    expect(screen.getByText(/Odwołania: 5/i)).toBeInTheDocument();
  });

  it('filters memories by search query and project filter', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce(mockMemories);
    render(<MemoryNexusPanel />);

    await waitFor(() => {
      expect(screen.getByText('claude-code')).toBeInTheDocument();
    });

    vi.mocked(apiClient.get).mockResolvedValueOnce([mockMemories[0]]);

    const searchInput = screen.getByPlaceholderText(/Szukaj w bazie wiedzy/i);
    fireEvent.change(searchInput, { target: { value: 'safeQuery' } });

    const searchButton = screen.getByRole('button', { name: /szukaj/i });
    fireEvent.click(searchButton);

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('/api/memory'),
        expect.objectContaining({
          params: expect.objectContaining({ q: 'safeQuery' })
        })
      );
    });
  });

  it('opens modal and creates a new lesson', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce(mockMemories);
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      id: 'mem-3',
      agent: 'antigravity',
      project: 'global',
      category: 'testing',
      content: 'Izoluj testy jednostkowe od połączeń TCP.',
      tags: ['vitest'],
      created_at: new Date().toISOString(),
      access_count: 0
    });

    render(<MemoryNexusPanel />);

    await waitFor(() => {
      expect(screen.getByText('claude-code')).toBeInTheDocument();
    });

    const addBtn = screen.getByRole('button', { name: /\+ Dodaj Lekcję/i });
    fireEvent.click(addBtn);

    // Form modal should be visible
    expect(screen.getByText(/Dodaj nową lekcję do bazy wiedzy/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Agent/i), { target: { value: 'antigravity' } });
    fireEvent.change(screen.getByLabelText(/Treść lekcji/i), { target: { value: 'Izoluj testy jednostkowe od połączeń TCP.' } });
    fireEvent.change(screen.getByLabelText(/Tagi/i), { target: { value: 'vitest' } });

    const saveBtn = screen.getByRole('button', { name: /Zapisz lekcję/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith('/api/memory', expect.objectContaining({
        agent: 'antigravity',
        content: 'Izoluj testy jednostkowe od połączeń TCP.',
        tags: ['vitest']
      }));
    });
  });

  it('deletes a memory card when delete button is clicked', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce(mockMemories);
    vi.mocked(apiClient.delete).mockResolvedValueOnce({ success: true });

    render(<MemoryNexusPanel />);

    await waitFor(() => {
      expect(screen.getByText('Zawsze używaj safeQuery jako wrapper wokół pool.query.')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByTitle(/Usuń wpis/i);
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(apiClient.delete).toHaveBeenCalledWith('/api/memory/mem-1');
    });
  });

  it('runs consolidation when "Konsolidacja" is clicked', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce(mockMemories);
    vi.mocked(apiClient.post).mockResolvedValueOnce({ success: true, deleted: 3 });

    render(<MemoryNexusPanel />);

    const consolidateBtn = screen.getByRole('button', { name: /Konsolidacja/i });
    fireEvent.click(consolidateBtn);

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith('/api/memory/consolidate', expect.any(Object));
      expect(screen.getByText(/Konsolidacja zakończona: usunięto 3 wpis/i)).toBeInTheDocument();
    });
  });

  it('updates live notification badge when memory:saved event is emitted via socket', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce(mockMemories);

    let socketCallback: (data: any) => void = () => {};
    const mockSocket = {
      on: vi.fn((event, cb) => {
        if (event === 'memory:saved') socketCallback = cb;
      }),
      off: vi.fn(),
    };

    render(<MemoryNexusPanel socket={mockSocket} />);

    await waitFor(() => {
      expect(screen.getByText('claude-code')).toBeInTheDocument();
    });

    expect(mockSocket.on).toHaveBeenCalledWith('memory:saved', expect.any(Function));

    // Simulate socket event
    act(() => {
      socketCallback({
        id: 'mem-live',
        agent: 'gemini',
        project: 'global',
        category: 'live',
        preview: 'Nowa live lekcja z innego agenta'
      });
    });

    await waitFor(() => {
      expect(screen.getByText(/Nowa lekcja zarejestrowana/i)).toBeInTheDocument();
    });
  });
});
