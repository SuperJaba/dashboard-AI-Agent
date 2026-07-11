import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App Component', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve([])
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
