import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

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
    render(<App />);
    expect(screen.getByText('Workspaces')).toBeInTheDocument();
  });

  it('renders Add Project button', async () => {
    render(<App />);
    expect(screen.getByRole('button', { name: /Add Project/i })).toBeInTheDocument();
  });
});
