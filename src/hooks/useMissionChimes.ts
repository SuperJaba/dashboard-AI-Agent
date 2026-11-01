import { useEffect, useCallback, useRef, useState } from 'react';

export const CHIMES: Record<string, { freq: number; type: OscillatorType; duration: number }> = {
  'task:completed':      { freq: 523.25, type: 'sine',     duration: 0.4 },  // C5 — sukces
  'build:failed':        { freq: 220,    type: 'sawtooth', duration: 0.6 },  // A3 — alarm
  'approval:requested':  { freq: 659.25, type: 'triangle', duration: 0.3 },  // E5 — uwaga
  'emergency:triggered': { freq: 880,    type: 'square',   duration: 1.0 },  // A5 — krytyczny
  'memory:saved':        { freq: 392,    type: 'sine',     duration: 0.2 },  // G4 — cichy info
};

interface UseMissionChimesOptions {
  enabled?: boolean;
  socket?: any;
}

export function useMissionChimes(opts: UseMissionChimesOptions = {}) {
  const [enabled, setEnabled] = useState(opts.enabled ?? true);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const playChime = useCallback(
    (eventName: string) => {
      if (!enabled) return;
      const chime = CHIMES[eventName];
      if (!chime) return;

      try {
        if (!audioCtxRef.current) {
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          if (!AudioContextClass) return;
          audioCtxRef.current = new AudioContextClass();
        }

        const ctx = audioCtxRef.current;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = chime.type;
        osc.frequency.value = chime.freq;

        const now = ctx.currentTime;
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + chime.duration);

        osc.start(now);
        osc.stop(now + chime.duration);
      } catch (err) {
        console.warn('Audio synthesis error:', err);
      }
    },
    [enabled]
  );

  useEffect(() => {
    const socket = opts.socket;
    if (!socket?.on) return;

    const events = Object.keys(CHIMES);
    const handlers = events.map((ev) => {
      const handler = () => playChime(ev);
      socket.on(ev, handler);
      return { ev, handler };
    });

    return () => {
      handlers.forEach(({ ev, handler }) => {
        socket.off?.(ev, handler);
      });
    };
  }, [opts.socket, playChime]);

  return { enabled, setEnabled, playChime };
}
