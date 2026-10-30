import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { AgentSchedulerWidget } from './agent-scheduler-widget';
import { apiClient } from '../shared/api-client';

vi.mock('../shared/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../hooks/useDashboardSocket', () => ({
  useDashboardSocket: () => ({
    socket: {
      on: vi.fn(),
      off: vi.fn(),
    },
  }),
}));

describe('AgentSchedulerWidget', () => {
  const mockTasks = [
    {
      id: 1,
      name: 'Nocny audyt bezpieczeństwa',
      task_type: 'npm_audit',
      command: 'npm audit',
      cron_expression: '0 3 * * *',
      enabled: true,
      last_run: '2026-10-29T03:00:00.000Z',
      last_status: 'success',
      last_output: 'found 0 vulnerabilities',
      created_at: '2026-10-28T12:00:00.000Z',
      is_running: false,
      has_active_cron: true,
    },
    {
      id: 2,
      name: 'Weryfikacja logów błędów',
      task_type: 'error_check',
      command: 'node check-logs.js',
      cron_expression: '0 * * * *',
      enabled: false,
      last_run: null,
      last_status: 'idle',
      last_output: null,
      created_at: '2026-10-28T12:00:00.000Z',
      is_running: false,
      has_active_cron: false,
    }
  ];

  const mockPresets = [
    {
      type: 'npm_audit',
      name: 'Nocny audyt bezpieczeństwa',
      description: 'Skanowanie podatności',
      defaultCommand: 'npm audit',
      defaultCron: '0 3 * * *'
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient.get).mockImplementation(async (url: string) => {
      if (url === '/api/scheduler/tasks') {
        return { tasks: mockTasks };
      }
      if (url === '/api/scheduler/presets') {
        return { presets: mockPresets };
      }
      return {};
    });
  });

  it('renders widget title and loaded scheduled tasks', async () => {
    render(<AgentSchedulerWidget />);

    expect(screen.getByText(/Harmonogram Zadań Agentów/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Nocny audyt bezpieczeństwa')).toBeInTheDocument();
      expect(screen.getByText('Weryfikacja logów błędów')).toBeInTheDocument();
      expect(screen.getByText('Sukces')).toBeInTheDocument();
      expect(screen.getByText('Oczekuje')).toBeInTheDocument();
    });
  });

  it('calls run task API when clicking "Uruchom teraz"', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ success: true });

    render(<AgentSchedulerWidget />);

    await waitFor(() => {
      expect(screen.getByText('Nocny audyt bezpieczeństwa')).toBeInTheDocument();
    });

    const runButtons = screen.getAllByTitle('Uruchom teraz');
    fireEvent.click(runButtons[0]);

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith('/api/scheduler/tasks/1/run');
    });
  });

  it('calls toggle API when clicking power button', async () => {
    vi.mocked(apiClient.patch).mockResolvedValue({ success: true, task: { ...mockTasks[0], enabled: false } });

    render(<AgentSchedulerWidget />);

    await waitFor(() => {
      expect(screen.getByText('Nocny audyt bezpieczeństwa')).toBeInTheDocument();
    });

    const toggleBtn = screen.getByTitle('Aktywne (kliknij, aby wstrzymać)');
    fireEvent.click(toggleBtn);

    await waitFor(() => {
      expect(apiClient.patch).toHaveBeenCalledWith('/api/scheduler/tasks/1/toggle', { enabled: false });
    });
  });

  it('opens and closes modal to add a new task', async () => {
    render(<AgentSchedulerWidget />);

    const addBtn = screen.getByText('Dodaj zadanie');
    fireEvent.click(addBtn);

    expect(screen.getByText('Dodaj nowe zadanie harmonogramu')).toBeInTheDocument();

    const cancelBtn = screen.getByText('Anuluj');
    fireEvent.click(cancelBtn);

    await waitFor(() => {
      expect(screen.queryByText('Dodaj nowe zadanie harmonogramu')).not.toBeInTheDocument();
    });
  });

  it('opens edit modal and submits updated task data via PUT', async () => {
    vi.mocked(apiClient.put).mockResolvedValue({ success: true });

    render(<AgentSchedulerWidget />);

    await waitFor(() => {
      expect(screen.getByText('Nocny audyt bezpieczeństwa')).toBeInTheDocument();
    });

    const editBtns = screen.getAllByTitle('Edytuj zadanie');
    fireEvent.click(editBtns[0]);

    expect(screen.getByText('Edytuj zadanie harmonogramu')).toBeInTheDocument();

<<<<<<< HEAD
    const submitBtn = screen.getByText('Zapisz zmiany');
    fireEvent.click(submitBtn);
=======
    const saveChangesBtn = screen.getByText('Zapisz zmiany');
    fireEvent.click(saveChangesBtn);
>>>>>>> 459cbfdc07f71aa09b3dcc5f3782effcd36d81af

    await waitFor(() => {
      expect(apiClient.put).toHaveBeenCalledWith('/api/scheduler/tasks/1', expect.objectContaining({
        name: 'Nocny audyt bezpieczeństwa',
<<<<<<< HEAD
=======
        cron_expression: '0 3 * * *'
>>>>>>> 459cbfdc07f71aa09b3dcc5f3782effcd36d81af
      }));
    });
  });
});
