import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { io, Socket } from 'socket.io-client';
import { X, Maximize2, Minimize2 } from 'lucide-react';

interface TerminalModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: {
    command: string;
    args: string[];
    cwd: string;
    env: any;
  } | null;
}

export function TerminalModal({ isOpen, onClose, config }: TerminalModalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const termInstance = useRef<Terminal | null>(null);
  const fitAddonInstance = useRef<FitAddon | null>(null);
  const socketRef = useRef<Socket | null>(null);
  
  useEffect(() => {
    if (!isOpen || !config || !terminalRef.current) return;
    
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

    socket.on('terminal_exit', ({ exitCode, signal }) => {
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
  }, [isOpen, config]);

  // Handle manual fullscreen toggle re-fit
  useEffect(() => {
    if (isOpen && fitAddonInstance.current && termInstance.current && socketRef.current) {
      setTimeout(() => {
        fitAddonInstance.current!.fit();
        socketRef.current!.emit('terminal_resize', { 
          cols: termInstance.current!.cols, 
          rows: termInstance.current!.rows 
        });
      }, 50);
    }
  }, [isFullscreen, isOpen]);

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.7)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: isFullscreen ? '0' : '2rem'
    }}>
      <div style={{
        background: '#1e293b',
        width: isFullscreen ? '100%' : '1024px',
        maxWidth: '100%',
        height: isFullscreen ? '100%' : '600px',
        maxHeight: '100%',
        borderRadius: isFullscreen ? '0' : '12px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        border: isFullscreen ? 'none' : '1px solid rgba(255,255,255,0.1)',
        transition: 'all 0.3s ease'
      }}>
        {/* Terminal Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.75rem 1rem',
          background: '#0f172a',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}>
          <div style={{ color: '#94a3b8', fontSize: '0.85rem', fontFamily: 'monospace' }}>
            {config?.cwd} &gt; {config?.command} {config?.args?.join(' ')}
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button 
              onClick={() => setIsFullscreen(!isFullscreen)}
              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button 
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}
            >
              <X size={16} />
            </button>
          </div>
        </div>
        
        {/* Xterm Container */}
        <div 
          ref={terminalRef} 
          style={{ flex: 1, padding: '0.5rem', background: '#0f172a', overflow: 'hidden' }}
        />
      </div>
    </div>
  );
}
