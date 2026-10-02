import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

export interface DashboardNotification {
  id: string;
  type?: string;
  title?: string;
  message: string;
  timestamp: string;
}

export interface AgentEvent {
  workerId?: string;
  agentId?: string;
  event: string;
  data?: unknown;
  timestamp: string;
}

export interface UseDashboardSocketOptions {
  autoConnect?: boolean;
  onNotification?: (notification: DashboardNotification) => void;
  onAgentEvent?: (event: AgentEvent) => void;
}

export interface UseDashboardSocketResult {
  connected: boolean;
  notifications: DashboardNotification[];
  lastAgentEvent: AgentEvent | null;
  subscribe: (room: string) => void;
  unsubscribe: (room: string) => void;
  socket: Socket | null;
}

export function useDashboardSocket(options: UseDashboardSocketOptions = {}): UseDashboardSocketResult {
  const { autoConnect = true, onNotification, onAgentEvent } = options;

  const [connected, setConnected] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<DashboardNotification[]>([]);
  const [lastAgentEvent, setLastAgentEvent] = useState<AgentEvent | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);

  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!autoConnect) return;

    const token = typeof window !== 'undefined' ? localStorage.getItem('dashboard_token') : null;
    const socketInstance = io('/dashboard', {
      auth: { token },
      transports: ['polling', 'websocket'],
    });
    socketRef.current = socketInstance;
    setSocket(socketInstance);

    socketInstance.on('connect', () => {
      setConnected(true);
    });

    socketInstance.on('disconnect', () => {
      setConnected(false);
    });

    socketInstance.on('notification', (notif: DashboardNotification) => {
      setNotifications((prev) => [notif, ...prev.slice(0, 49)]);
      if (onNotification) onNotification(notif);
    });

    socketInstance.on('agent_event', (event: AgentEvent) => {
      setLastAgentEvent(event);
      if (onAgentEvent) onAgentEvent(event);
    });

    return () => {
      socketInstance.disconnect();
      socketRef.current = null;
      setSocket(null);
    };
  }, [autoConnect, onNotification, onAgentEvent]);

  const subscribe = useCallback((room: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('subscribe', room);
    }
  }, []);

  const unsubscribe = useCallback((room: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('unsubscribe', room);
    }
  }, []);

  return {
    connected,
    notifications,
    lastAgentEvent,
    subscribe,
    unsubscribe,
    socket,
  };
}
