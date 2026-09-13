import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import App from './App';
import { PreferencesProvider } from './preferences/PreferencesContext';

describe('App Component', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      let data: any = [];
      if (url && typeof url === 'string' && url.includes('/api/settings')) {
        data = {};
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(data)
      });
    });
  });

  it('renders Workspaces heading', async () => {
    await act(async () => {
      render(<PreferencesProvider><App /></PreferencesProvider>);
    });
    expect(screen.getByText('Workspaces')).toBeInTheDocument();
  });

  it('renders Add Project button', async () => {
    await act(async () => {
      render(<PreferencesProvider><App /></PreferencesProvider>);
    });
    expect(screen.getByRole('button', { name: /Add Project/i })).toBeInTheDocument();
  });

  it('renders Mark Completed button when workspace has active project and tasks header is open', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url && typeof url === 'string' && url.includes('/api/projects')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            { id: 1, name: 'Test Project', path: '/test', tasks: [{ id: 101, title: 'Task 1', status: 'pending' }], complete: 0 }
          ])
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({})
      });
    });

    await act(async () => {
      render(<PreferencesProvider><App /></PreferencesProvider>);
    });

    const tasksHeader = screen.getByRole('button', { name: /Current Tasks/i });
    await act(async () => {
      tasksHeader.click();
    });

    expect(screen.getByRole('button', { name: /^Mark Completed$/i })).toBeInTheDocument();
  });
});

