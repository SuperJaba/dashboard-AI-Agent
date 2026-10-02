import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { io, Socket } from 'socket.io-client';
import { X, Minus, Maximize2, Laptop } from 'lucide-react';
import { LocalWorkerModal } from './LocalWorkerModal';

interface TerminalViewProps {
  config: {
    command: string;
    args: string[];
    cwd: string;
    env: any;
    executionTarget?: 'remote' | 'worker' | 'auto';
    targetWorkerId?: string;
    scriptContent?: string;
  } | null;
  onClose: () => void;
}

export function TerminalView({ config, onClose }: TerminalViewProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const termInstance = useRef<Terminal | null>(null);
  const fitAddonInstance = useRef<FitAddon | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const [isMinimized, setIsMinimized] = useState(false);
  // Default to a size that comfortably fits smaller/laptop-class screens
  // (e.g. 14" displays), scaled to a fraction of the viewport, capped at 800x600.
  const defaultSize = {
    width: Math.min(800, Math.round(window.innerWidth * 0.7)),
    height: Math.min(600, Math.round(window.innerHeight * 0.7))
  };
  const [position, setPosition] = useState({
    x: window.innerWidth / 2 - defaultSize.width / 2,
    y: window.innerHeight / 2 - defaultSize.height / 2
  });
  const [size, setSize] = useState(defaultSize);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [execTarget, setExecTarget] = useState<'remote' | 'worker' | 'auto'>(config?.executionTarget || 'auto');
  const [workers, setWorkers] = useState<any[]>([]);
  const [showWorkerModal, setShowWorkerModal] = useState(false);

  const dragStartPos = useRef({ x: 0, y: 0 });
  const initialPos = useRef({ x: 0, y: 0 });
  const initialSize = useRef({ width: 0, height: 0 });

  useEffect(() => {
    // Fetch active workers list
    const token = localStorage.getItem('dashboard_token');
    fetch('/api/agents/workers', {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
    })
      .then(res => res.ok ? res.json() : [])
      .then(data => setWorkers(Array.isArray(data) ? data : []))
      .catch(() => setWorkers([]));
  }, []);

  useEffect(() => {
    if (!config || !terminalRef.current) return;
    
    // Init Xterm with explicit dimensions and wrapping options
    const term = new Terminal({
      cursorBlink: true,
      cols: 100,
      rows: 30,
      convertEol: true,
      theme: {
        background: '#0f172a',
        foreground: '#f8fafc',
      },
      fontFamily: '"Fira Code", monospace',
      fontSize: 14,
    });
    
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();
    term.focus();
    
    termInstance.current = term;
    fitAddonInstance.current = fitAddon;

    // Connect to WebSocket /pty namespace with token authentication and fallback transports
    const token = localStorage.getItem('dashboard_token');
    const socket = io('/pty', {
      auth: { token },
      transports: ['polling', 'websocket']
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      term.write('\x1b[32m[Connected to Backend]\x1b[0m\r\n');
      term.focus();
      
      // Spawn pty on backend or local worker
      socket.emit('spawn_terminal', {
        command: config.command,
        args: config.args,
        cwd: config.cwd,
        env: config.env,
        executionTarget: execTarget,
        targetWorkerId: config.targetWorkerId,
        scriptContent: config.scriptContent
      });
      
      // Resize to current xterm size
      socket.emit('terminal_resize', { cols: term.cols, rows: term.rows });
    });

    socket.on('terminal_data', (data: string) => {
      term.write(data);
    });

    socket.on('terminal_exit', ({ exitCode }) => {
      term.write(`\r\n\x1b[33m[Process exited with code ${exitCode}]\x1b[0m\r\n`);
    });

    socket.on('terminal_error', (msg: string) => {
      term.write(`\r\n\x1b[31m[Error: ${msg}]\x1b[0m\r\n`);
    });

    // Intercept Enter key combinations (Ctrl+Enter, Meta+Enter, Shift+Enter) to emit \r directly
    term.attachCustomKeyEventHandler((event: KeyboardEvent) => {
      if (event.type === 'keydown' && event.key === 'Enter') {
        if (event.ctrlKey || event.metaKey || event.shiftKey) {
          socket.emit('terminal_input', '\r');
          return false;
        }
      }
      return true;
    });

    // Handle user input
    term.onData(data => {
      // Normalize any Kitty keyboard protocol Enter sequences (\x1b[13;...u or [13;...u) to \r
      if (data.includes('[13;') && data.includes('u')) {
        const normalized = data.replace(new RegExp(String.fromCharCode(27) + '\\[13;[0-9;]+u', 'g'), '\r').replace(/\[13;[0-9;]+u/g, '\r');
        socket.emit('terminal_input', normalized);
        return;
      }
      socket.emit('terminal_input', data);
    });

    // Handle window resize
    const handleResize = () => {
      fitAddon.fit();
      socket.emit('terminal_resize', { cols: term.cols, rows: term.rows });
    };
    
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      socket.disconnect();
      term.dispose();
    };
  }, [config, execTarget]);


  // Handle resizing terminal when restoring from minimized state
  useEffect(() => {
    if (!isMinimized && fitAddonInstance.current && termInstance.current && socketRef.current) {
      setTimeout(() => {
        fitAddonInstance.current?.fit();
        socketRef.current?.emit('terminal_resize', { 
          cols: termInstance.current?.cols, 
          rows: termInstance.current?.rows 
        });
      }, 50);
    }
  }, [isMinimized]);

  useEffect(() => {
    if (!isDragging) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      setPosition({
        x: initialPos.current.x + (e.clientX - dragStartPos.current.x),
        y: initialPos.current.y + (e.clientY - dragStartPos.current.y)
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  useEffect(() => {
    if (!isResizing) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      setSize({
        width: Math.max(400, initialSize.current.width + (e.clientX - dragStartPos.current.x)),
        height: Math.max(200, initialSize.current.height + (e.clientY - dragStartPos.current.y))
      });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      if (fitAddonInstance.current && termInstance.current && socketRef.current) {
        fitAddonInstance.current.fit();
        socketRef.current.emit('terminal_resize', { cols: termInstance.current.cols, rows: termInstance.current.rows });
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    initialPos.current = { ...position };
  };

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    initialSize.current = { ...size };
  };

  if (!config) return null;

  return createPortal(
    <div style={{
      position: 'fixed',
      left: `${position.x}px`,
      top: `${position.y}px`,
      width: `${size.width}px`,
      height: isMinimized ? '44px' : `${size.height}px`,
      background: '#0f172a',
      borderRadius: '8px',
      overflow: 'hidden',
      border: '1px solid var(--glass-border)',
      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 1000,
      // Usunęliśmy płynne przejście wysokości, ponieważ powodowało ono, że xterm.js
      // źle obliczał wielkość znaków podczas animacji, co psuło zaznaczanie tekstu myszką.
    }}>
      <div 
        onMouseDown={handleMouseDown}
        style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          padding: '0.75rem 1rem', 
          background: '#1e293b', 
          borderBottom: '1px solid var(--glass-border)',
          cursor: isDragging ? 'grabbing' : 'grab',
          userSelect: 'none'
        }}
      >
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ef4444' }} />
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#f59e0b' }} />
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#10b981' }} />
          <span style={{ marginLeft: '0.5rem', color: '#94a3b8', fontSize: '0.85rem', fontFamily: 'var(--mono)', pointerEvents: 'none' }}>Live Agent Terminal</span>
          <div style={{ marginLeft: '1rem', display: 'flex', alignItems: 'center', gap: '0.25rem', background: '#0f172a', borderRadius: '4px', padding: '2px 6px', border: '1px solid #334155' }}>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Target:</span>
            <select
              value={execTarget}
              onChange={(e) => setExecTarget(e.target.value as 'remote' | 'worker' | 'auto')}
              style={{
                background: 'transparent',
                color: execTarget === 'worker' ? '#38bdf8' : execTarget === 'remote' ? '#a855f7' : '#10b981',
                border: 'none',
                fontSize: '0.75rem',
                fontFamily: 'var(--mono)',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="auto">⚡ Auto ({workers.length > 0 ? 'Local Worker' : 'Remote'})</option>
              <option value="worker" disabled={workers.length === 0}>💻 Local Worker ({workers.length})</option>
              <option value="remote">🌐 Remote Server</option>
            </select>
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setShowWorkerModal(true); }}
            title="Pobierz komendę i token Socket.IO dla Local Workera"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              background: 'rgba(56, 189, 248, 0.15)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              borderRadius: '4px',
              padding: '2px 6px',
              color: '#38bdf8',
              fontSize: '0.75rem',
              cursor: 'pointer'
            }}
          >
            <Laptop size={12} />
            <span>Tunel PC</span>
          </button>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }} 
            style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          >
            {isMinimized ? <Maximize2 size={16} /> : <Minus size={16} />}
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onClose(); }} 
            style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          >
            <X size={16} />
          </button>
        </div>
      </div>
      <div style={{ flex: 1, padding: '0.5rem', overflow: 'hidden', display: isMinimized ? 'none' : 'block', position: 'relative' }}>
        <div ref={terminalRef} style={{ width: '100%', height: '100%' }} />
        {(isDragging || isResizing) && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 9999, cursor: isResizing ? 'nwse-resize' : 'grabbing' }} />
        )}
      </div>
      {!isMinimized && (
        <div 
          onMouseDown={handleResizeMouseDown}
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: '16px',
            height: '16px',
            cursor: 'nwse-resize',
            zIndex: 10000
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '100%', height: '100%', color: '#94a3b8' }}>
            <path d="M21 15l-6 6" />
            <path d="M21 8l-13 13" />
          </svg>
        </div>
      )}
      <LocalWorkerModal isOpen={showWorkerModal} onClose={() => setShowWorkerModal(false)} />
    </div>,
    document.body
  );
}
