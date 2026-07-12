import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { io, Socket } from 'socket.io-client';
import { X, Minus, Maximize2 } from 'lucide-react';

interface TerminalViewProps {
  config: {
    command: string;
    args: string[];
    cwd: string;
    env: any;
  } | null;
  onClose: () => void;
}

export function TerminalView({ config, onClose }: TerminalViewProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const termInstance = useRef<Terminal | null>(null);
  const fitAddonInstance = useRef<FitAddon | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const [isMinimized, setIsMinimized] = useState(false);
  const [position, setPosition] = useState({ x: window.innerWidth / 2 - 400, y: window.innerHeight / 2 - 300 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!config || !terminalRef.current) return;
    
    // Init Xterm
    const term = new Terminal({
      cursorBlink: true,
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

    // Connect to WebSocket
    const socket = io('http://localhost:3001');
    socketRef.current = socket;

    socket.on('connect', () => {
      term.write('\x1b[32m[Connected to Backend]\x1b[0m\r\n');
      term.focus();
      
      // Spawn pty on backend
      socket.emit('spawn_terminal', {
        command: config.command,
        args: config.args,
        cwd: config.cwd,
        env: config.env
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

    // Handle user input
    term.onData(data => {
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
  }, [config]);

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
      setPosition(prev => ({
        x: prev.x + (e.clientX - dragStartPos.current.x),
        y: prev.y + (e.clientY - dragStartPos.current.y)
      }));
      dragStartPos.current = { x: e.clientX, y: e.clientY };
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

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartPos.current = { x: e.clientX, y: e.clientY };
  };

  if (!config) return null;

  return (
    <div style={{
      position: 'fixed',
      left: `${position.x}px`,
      top: `${position.y}px`,
      width: '800px',
      height: isMinimized ? '44px' : '600px',
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
          <span style={{ marginLeft: '1rem', color: '#94a3b8', fontSize: '0.85rem', fontFamily: 'var(--mono)', pointerEvents: 'none' }}>Live Agent Terminal</span>
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
      <div style={{ flex: 1, padding: '0.5rem', overflow: 'hidden', display: isMinimized ? 'none' : 'block' }}>
        <div ref={terminalRef} style={{ width: '100%', height: '100%' }} />
      </div>
    </div>
  );
}
