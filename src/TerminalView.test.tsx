import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TerminalView } from './TerminalView';

// Mock xterm
vi.mock('@xterm/xterm', () => {
  return {
    Terminal: class {
      cols = 80;
      rows = 24;
      loadAddon = vi.fn();
      open = vi.fn();
      write = vi.fn();
      onData = vi.fn();
      dispose = vi.fn();
      focus = vi.fn();
      attachCustomKeyEventHandler = vi.fn();
    }
  };
});

// Mock fit addon
vi.mock('@xterm/addon-fit', () => {
  return {
    FitAddon: class {
      fit = vi.fn();
    }
  };
});

// Mock socket.io-client
vi.mock('socket.io-client', () => {
  return {
    io: vi.fn(() => ({
      on: vi.fn(),
      emit: vi.fn(),
      disconnect: vi.fn(),
      close: vi.fn()
    }))
  };
});

// Mock fetch for active workers
global.fetch = vi.fn().mockImplementation(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve([])
  })
);

describe('TerminalView', () => {
  it('renders terminal title correctly', () => {
    const config = { command: 'bash', args: [], cwd: '/', env: {} };
    render(<TerminalView config={config} onClose={() => {}} />);
    
    expect(screen.getByText('Live Agent Terminal')).toBeInTheDocument();
  });
});
