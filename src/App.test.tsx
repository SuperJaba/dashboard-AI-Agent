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
});
