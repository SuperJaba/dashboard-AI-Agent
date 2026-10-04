import { useState, useEffect, useRef } from 'react';

export interface UseLiveTelemetryOptions {
  events?: string[];
  url?: string;
  heartbeatTimeoutMs?: number;
}

export interface UseLiveTelemetryResult {
  connected: boolean;
  lastEvent: unknown;
  error: string | null;
}

export function useLiveTelemetry(options: UseLiveTelemetryOptions = {}): UseLiveTelemetryResult {
  const {
    events,
    url = '/api/events',
    heartbeatTimeoutMs = 45_000,
  } = options;

  const [connected, setConnected] = useState<boolean>(false);
  const [lastEvent, setLastEvent] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const backoffRef = useRef<number>(1000);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const eventsKey = events ? events.join(',') : '';

  useEffect(() => {
    let isCancelled = false;

    function resetHeartbeat() {
      if (heartbeatTimerRef.current) {
        clearTimeout(heartbeatTimerRef.current);
      }
      heartbeatTimerRef.current = setTimeout(() => {
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }
        setConnected(false);
        setError('Brak sygnału heartbeat — ponawianie...');
        scheduleReconnect();
      }, heartbeatTimeoutMs);
    }

    function scheduleReconnect() {
      if (isCancelled) return;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      const delay = backoffRef.current;
      backoffRef.current = Math.min(backoffRef.current * 2, 30_000);

      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, delay);
    }

    function connect() {
      if (isCancelled) return;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const token = typeof window !== 'undefined'
        ? (localStorage.getItem('dashboard_token') || localStorage.getItem('token') || '')
        : '';

      const params = new URLSearchParams();
      if (eventsKey) params.set('events', eventsKey);
      if (token) params.set('token', token);

      const queryString = params.toString() ? `?${params.toString()}` : '';
      const fullUrl = `${url}${queryString}`;

      try {
        const es = new EventSource(fullUrl);
        eventSourceRef.current = es;

        es.onopen = () => {
          if (isCancelled) return;
          setConnected(true);
          setError(null);
          backoffRef.current = 1000;
          resetHeartbeat();
        };

        es.onerror = () => {
          if (isCancelled) return;
          es.close();
          eventSourceRef.current = null;
          setConnected(false);
          setError('Błąd połączenia SSE');
          scheduleReconnect();
        };

        const targetEventTypes = eventsKey ? eventsKey.split(',') : ['system-metrics', 'agent-status', 'heartbeat'];

        for (const evType of targetEventTypes) {
          es.addEventListener(evType, (e: MessageEvent) => {
            if (isCancelled) return;
            resetHeartbeat();
            try {
              const parsed = JSON.parse(e.data);
              setLastEvent({ type: evType, data: parsed });
            } catch {
              setLastEvent({ type: evType, data: e.data });
            }
          });
        }
      } catch (err: unknown) {
        if (isCancelled) return;
        setConnected(false);
        setError(err instanceof Error ? err.message : 'Nie można nawiązać połączenia');
        scheduleReconnect();
      }
    }

    connect();

    return () => {
      isCancelled = true;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (heartbeatTimerRef.current) {
        clearTimeout(heartbeatTimerRef.current);
      }
    };
  }, [url, eventsKey, heartbeatTimeoutMs]);

  return { connected, lastEvent, error };
}
