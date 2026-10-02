import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLiveTelemetry } from './useLiveTelemetry';

class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  listeners: Record<string, ((e: any) => void)[]> = {};
  closed = false;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, cb: (e: any) => void) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(cb);
  }

  close() {
    this.closed = true;
  }

  emitOpen() {
    if (this.onopen) this.onopen();
  }

  emitError() {
    if (this.onerror) this.onerror();
  }

  emitEvent(type: string, data: any) {
    const list = this.listeners[type] || [];
    for (const cb of list) {
      cb({ data: JSON.stringify(data) });
    }
  }
}

describe('useLiveTelemetry', () => {
  const originalEventSource = globalThis.EventSource;

  beforeEach(() => {
    MockEventSource.instances = [];
    // @ts-ignore
    globalThis.EventSource = MockEventSource;
    vi.useFakeTimers();
  });

  afterEach(() => {
    globalThis.EventSource = originalEventSource;
    vi.useRealTimers();
  });

  it('initializes with disconnected state', () => {
    const { result } = renderHook(() => useLiveTelemetry({ url: '/api/events' }));
    expect(result.current.connected).toBe(false);
    expect(result.current.lastEvent).toBeNull();
  });

  it('updates connected status when EventSource opens', () => {
    const { result } = renderHook(() => useLiveTelemetry({ url: '/api/events' }));
    const instance = MockEventSource.instances[0];
    expect(instance).toBeDefined();

    act(() => {
      instance.emitOpen();
    });

    expect(result.current.connected).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('receives and parses events correctly', () => {
    const { result } = renderHook(() => useLiveTelemetry({ url: '/api/events', events: ['heartbeat'] }));
    const instance = MockEventSource.instances[0];

    act(() => {
      instance.emitOpen();
      instance.emitEvent('heartbeat', { ts: '2026-10-02T00:00:00.000Z' });
    });

    expect(result.current.lastEvent).toEqual({
      type: 'heartbeat',
      data: { ts: '2026-10-02T00:00:00.000Z' }
    });
  });

  it('sets disconnected and error on connection error', () => {
    const { result } = renderHook(() => useLiveTelemetry({ url: '/api/events' }));
    const instance = MockEventSource.instances[0];

    act(() => {
      instance.emitOpen();
      instance.emitError();
    });

    expect(result.current.connected).toBe(false);
    expect(result.current.error).toBe('Błąd połączenia SSE');
  });
});
