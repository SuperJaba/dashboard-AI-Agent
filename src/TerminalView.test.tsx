import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react';
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

// Mock socket.io-client so no real WebSocket connection is attempted
vi.mock('socket.io-client', () => {
  const socket = {
    on: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
  };
  return { io: vi.fn(() => socket) };
});

describe('TerminalView', () => {
  beforeEach(() => {
    // Mock fetch so the workers useEffect doesn't trigger an unwrapped state update
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: false, json: () => Promise.resolve([]) } as Response)
    );
  });

  it('renders terminal title correctly', async () => {
    const config = { command: 'bash', args: [], cwd: '/', env: {} };

    await act(async () => {
      render(<TerminalView config={config} onClose={() => {}} />);
    });
    
    expect(screen.getByText('Live Agent Terminal')).toBeInTheDocument();
  });
});
