// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDashboardSocket } from './useDashboardSocket';

// Mock socket.io-client
const mockSocket = {
  connected: false,
  callbacks: {} as Record<string, ((...args: any[]) => void)[]>,
  on(event: string, cb: (...args: any[]) => void) {
    if (!this.callbacks[event]) this.callbacks[event] = [];
    this.callbacks[event].push(cb);
    return this;
  },
  emit: vi.fn(),
  disconnect: vi.fn(),
  _trigger(event: string, ...args: any[]) {
    const handlers = this.callbacks[event] || [];
    handlers.forEach(h => h(...args));
  },
};

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mockSocket),
}));

describe('useDashboardSocket', () => {
  beforeEach(() => {
    mockSocket.callbacks = {};
    mockSocket.connected = false;
    mockSocket.emit.mockClear();
    mockSocket.disconnect.mockClear();
  });

  it('initializes with disconnected state', () => {
    const { result } = renderHook(() => useDashboardSocket({ autoConnect: true }));
    expect(result.current.connected).toBe(false);
    expect(result.current.notifications).toEqual([]);
    expect(result.current.lastAgentEvent).toBeNull();
  });

  it('updates connected status on connect event', () => {
    const { result } = renderHook(() => useDashboardSocket());

    act(() => {
      mockSocket.connected = true;
      mockSocket._trigger('connect');
    });

    expect(result.current.connected).toBe(true);
  });

  it('receives dashboard notifications', () => {
    const onNotif = vi.fn();
    const { result } = renderHook(() => useDashboardSocket({ onNotification: onNotif }));

    const notif = {
      id: 'notif_1',
      title: 'Alert',
      message: 'High CPU usage',
      timestamp: '2026-10-02T02:00:00.000Z',
    };

    act(() => {
      mockSocket._trigger('notification', notif);
    });

    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.notifications[0]).toEqual(notif);
    expect(onNotif).toHaveBeenCalledWith(notif);
  });

  it('receives agent events', () => {
    const onAgent = vi.fn();
    const { result } = renderHook(() => useDashboardSocket({ onAgentEvent: onAgent }));

    const agentEv = {
      workerId: 'worker_1',
      event: 'agent_started',
      timestamp: '2026-10-02T02:00:00.000Z',
    };

    act(() => {
      mockSocket._trigger('agent_event', agentEv);
    });

    expect(result.current.lastAgentEvent).toEqual(agentEv);
    expect(onAgent).toHaveBeenCalledWith(agentEv);
  });

  it('allows subscribing and unsubscribing from rooms when connected', () => {
    const { result } = renderHook(() => useDashboardSocket());

    mockSocket.connected = true;

    act(() => {
      result.current.subscribe('alerts');
      result.current.unsubscribe('alerts');
    });

    expect(mockSocket.emit).toHaveBeenCalledWith('subscribe', 'alerts');
    expect(mockSocket.emit).toHaveBeenCalledWith('unsubscribe', 'alerts');
  });

  it('disconnects socket on unmount', () => {
    const { unmount } = renderHook(() => useDashboardSocket());
    unmount();
    expect(mockSocket.disconnect).toHaveBeenCalled();
  });
});
