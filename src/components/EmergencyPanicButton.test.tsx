import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EmergencyPanicButton } from './EmergencyPanicButton';
import { apiClient } from '../shared/api-client';

vi.mock('../shared/api-client', () => ({
  apiClient: {
    post: vi.fn(),
  },
}));

describe('EmergencyPanicButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders panic button in idle state', () => {
    render(<EmergencyPanicButton />);
    const button = screen.getByRole('button', { name: /emergency stop|panic|awaryjne zatrzymanie/i });
    expect(button).toBeInTheDocument();
  });

  it('prompts confirmation modal on click', () => {
    render(<EmergencyPanicButton />);
    const button = screen.getByRole('button', { name: /emergency stop|panic|awaryjne zatrzymanie/i });
    fireEvent.click(button);

    expect(screen.getByText(/potwierdź zatrzymanie|are you sure/i)).toBeInTheDocument();
  });

  it('aborts on cancel without calling API', () => {
    render(<EmergencyPanicButton />);
    const button = screen.getByRole('button', { name: /emergency stop|panic|awaryjne zatrzymanie/i });
    fireEvent.click(button);

    const cancelButton = screen.getByRole('button', { name: /anuluj|cancel/i });
    fireEvent.click(cancelButton);

    expect(apiClient.post).not.toHaveBeenCalled();
    expect(screen.queryByText(/potwierdź zatrzymanie|are you sure/i)).not.toBeInTheDocument();
  });

  it('calls emergency-stop endpoint and displays result toast on confirm', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      success: true,
      terminatedTasks: 3,
      killedProcesses: 2,
      freedVram: true,
    });

    render(<EmergencyPanicButton />);
    const button = screen.getByRole('button', { name: /emergency stop|panic|awaryjne zatrzymanie/i });
    fireEvent.click(button);

    const confirmButton = screen.getByRole('button', { name: /zatrzymaj wszystko|confirm/i });
    fireEvent.click(confirmButton);

    expect(apiClient.post).toHaveBeenCalledWith('/api/agents/emergency-stop');

    await waitFor(() => {
      expect(screen.getByText(/zatrzymano 3 zadań/i)).toBeInTheDocument();
    });
  });
});
