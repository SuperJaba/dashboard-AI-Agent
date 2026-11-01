import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMissionChimes } from './useMissionChimes';

describe('useMissionChimes', () => {
  let mockOscillator: any;
  let mockGain: any;
  let mockAudioContext: any;
  let mockSocketListeners: Record<string, Function>;
  let mockSocket: any;

  beforeEach(() => {
    mockSocketListeners = {};
    mockSocket = {
      on: vi.fn((event, cb) => {
        mockSocketListeners[event] = cb;
      }),
      off: vi.fn((event) => {
        delete mockSocketListeners[event];
      })
    };

    mockOscillator = {
      connect: vi.fn(),
      type: 'sine',
      frequency: { value: 0 },
      start: vi.fn(),
      stop: vi.fn()
    };

    mockGain = {
      connect: vi.fn(),
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn()
      }
    };

    mockAudioContext = {
      currentTime: 10,
      destination: {},
      createOscillator: vi.fn().mockReturnValue(mockOscillator),
      createGain: vi.fn().mockReturnValue(mockGain)
    };

    globalThis.AudioContext = class {
      currentTime = 10;
      destination = {};
      createOscillator = mockAudioContext.createOscillator;
      createGain = mockAudioContext.createGain;
    } as any;
  });

  it('exposes enabled state and can toggle enabled', () => {
    const { result } = renderHook(() => useMissionChimes({ socket: mockSocket, enabled: true }));
    expect(result.current.enabled).toBe(true);

    act(() => {
      result.current.setEnabled(false);
    });

    expect(result.current.enabled).toBe(false);
  });

  it('plays chime when playChime is called with known event', () => {
    const { result } = renderHook(() => useMissionChimes({ socket: mockSocket, enabled: true }));

    act(() => {
      result.current.playChime('task:completed');
    });

    expect(mockAudioContext.createOscillator).toHaveBeenCalled();
    expect(mockOscillator.type).toBe('sine');
    expect(mockOscillator.frequency.value).toBeCloseTo(523.25);
    expect(mockOscillator.start).toHaveBeenCalled();
  });

  it('plays alarm chime on build:failed', () => {
    const { result } = renderHook(() => useMissionChimes({ socket: mockSocket, enabled: true }));

    act(() => {
      result.current.playChime('build:failed');
    });

    expect(mockOscillator.type).toBe('sawtooth');
    expect(mockOscillator.frequency.value).toBe(220);
  });

  it('does not play audio when enabled is false', () => {
    const { result } = renderHook(() => useMissionChimes({ socket: mockSocket, enabled: false }));

    act(() => {
      result.current.playChime('task:completed');
    });

    expect(mockAudioContext.createOscillator).not.toHaveBeenCalled();
  });

  it('triggers chime automatically on socket event emission', () => {
    renderHook(() => useMissionChimes({ socket: mockSocket, enabled: true }));

    expect(mockSocket.on).toHaveBeenCalledWith('task:completed', expect.any(Function));

    act(() => {
      mockSocketListeners['task:completed']?.();
    });

    expect(mockAudioContext.createOscillator).toHaveBeenCalled();
  });
});
