import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ToastProvider, useToast } from './ToastProvider';

function ToastHarness() {
  const toast = useToast();

  return (
    <div>
      <button type="button" onClick={() => toast.success('Zapisano zmiany')}>
        add-success
      </button>
      <button type="button" onClick={() => toast.error('Wystąpił błąd')}>
        add-error
      </button>
      <button type="button" onClick={() => toast.warning('Uwaga', 60)}>
        add-warning-short
      </button>
    </div>
  );
}

function renderHarness() {
  return render(
    <ToastProvider>
      <ToastHarness />
    </ToastProvider>,
  );
}

describe('ToastProvider', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders a toast message after toast.success is called', () => {
    renderHarness();

    expect(screen.queryByText('Zapisano zmiany')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('add-success'));

    expect(screen.getByText('Zapisano zmiany')).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('auto-dismisses a toast after its duration elapses', async () => {
    renderHarness();

    fireEvent.click(screen.getByText('add-warning-short'));
    expect(screen.getByText('Uwaga')).toBeInTheDocument();

    await waitFor(() => expect(screen.queryByText('Uwaga')).not.toBeInTheDocument(), {
      timeout: 2000,
    });
  });

  it('removes a toast when the close button is clicked', async () => {
    renderHarness();

    fireEvent.click(screen.getByText('add-error'));
    expect(screen.getByText('Wystąpił błąd')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Zamknij' }));

    await waitFor(() => expect(screen.queryByText('Wystąpił błąd')).not.toBeInTheDocument(), {
      timeout: 2000,
    });
  });
});
