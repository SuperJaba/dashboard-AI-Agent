import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, Copy, Check, Laptop, Terminal, Wifi, WifiOff, 
  ShieldCheck, Key, Eye, EyeOff, RefreshCw, Server
} from 'lucide-react';

interface LocalWorkerModalProps {
  isOpen: boolean;
  onClose: () => void;
  token?: string;
}

export function LocalWorkerModal({ isOpen, onClose, token: propToken }: LocalWorkerModalProps) {
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [isGeneratingToken, setIsGeneratingToken] = useState(false);
  const [commandTab, setCommandTab] = useState<'npm' | 'node' | 'bash' | 'powershell'>('npm');

  const defaultUrl = typeof window !== 'undefined'
    ? (window.location.port === '5173' ? 'http://localhost:3001' : window.location.origin)
    : 'https://dashboard.jagger2.ct8.pl';

  const [serverUrl, setServerUrl] = useState(defaultUrl);
  const [workerName, setWorkerName] = useState('Moj-PC');
  const [activeToken, setActiveToken] = useState(
    propToken || (typeof window !== 'undefined' ? (localStorage.getItem('dashboard_token') || localStorage.getItem('token') || '') : '')
  );
  const [workers, setWorkers] = useState<any[]>([]);

  // Synchronize with propToken or localStorage
  useEffect(() => {
    if (propToken) {
      setActiveToken(propToken);
    } else if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('dashboard_token') || localStorage.getItem('token');
      if (stored) setActiveToken(stored);
    }
  }, [propToken]);

  const fetchSocketInfo = useCallback(async () => {
    try {
      const headers: Record<string, string> = {};
      const tokenToSend = activeToken || (typeof window !== 'undefined' ? localStorage.getItem('dashboard_token') : '');
      if (tokenToSend) {
        headers['Authorization'] = `Bearer ${tokenToSend}`;
      }

      const res = await fetch('/api/socket-info', { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.token && (!activeToken || activeToken === 'fallback-super-secret-key-123')) {
          setActiveToken(data.token);
          if (typeof window !== 'undefined' && !localStorage.getItem('dashboard_token')) {
            localStorage.setItem('dashboard_token', data.token);
          }
        }
        if (data.workers && Array.isArray(data.workers)) {
          setWorkers(data.workers);
        }
      } else {
        // Fallback to /api/agents/workers
        const wRes = await fetch('/api/agents/workers', { headers });
        if (wRes.ok) {
          const wData = await wRes.json();
          setWorkers(Array.isArray(wData) ? wData : []);
        }
      }
    } catch (e) {
      console.warn('Socket info fetch error:', e);
    }
  }, [activeToken]);

  useEffect(() => {
    if (isOpen) {
      fetchSocketInfo();
      const interval = setInterval(fetchSocketInfo, 3000);
      return () => clearInterval(interval);
    }
  }, [isOpen, fetchSocketInfo]);

  const handleGenerateNewToken = async () => {
    setIsGeneratingToken(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (activeToken) {
        headers['Authorization'] = `Bearer ${activeToken}`;
      }
      const res = await fetch('/api/socket/token', { method: 'POST', headers });
      if (res.ok) {
        const data = await res.json();
        if (data.token) {
          setActiveToken(data.token);
          if (typeof window !== 'undefined') {
            localStorage.setItem('dashboard_token', data.token);
          }
        }
      }
    } catch (err) {
      console.error('Failed to generate dedicated socket token:', err);
    } finally {
      setIsGeneratingToken(false);
    }
  };

  const copyToClipboard = async (text: string, setCopied: (v: boolean) => void) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const safeToken = activeToken || 'twój_token_socket';
  const cleanServerUrl = (serverUrl || defaultUrl).trim().replace(/\/$/, '');

  const commands = {
    npm: `DASHBOARD_SERVER_URL="${cleanServerUrl}" DASHBOARD_TOKEN="${safeToken}" WORKER_NAME="${workerName}" npm run agent:worker`,
    node: `node scripts/local-agent-worker.js ${cleanServerUrl} "${safeToken}" "${workerName}"`,
    bash: `export DASHBOARD_SERVER_URL="${cleanServerUrl}"\nexport DASHBOARD_TOKEN="${safeToken}"\nexport WORKER_NAME="${workerName}"\nnpm run agent:worker`,
    powershell: `$env:DASHBOARD_SERVER_URL="${cleanServerUrl}"\n$env:DASHBOARD_TOKEN="${safeToken}"\n$env:WORKER_NAME="${workerName}"\nnpm run agent:worker`
  };

  const currentCommand = commands[commandTab];

  if (!isOpen) return null;

  return createPortal(
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Local Agent Worker & Socket.IO"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        padding: '1rem',
        overscrollBehavior: 'contain'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#0f172a',
          border: '1px solid #334155',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
          borderRadius: '16px',
          width: '680px',
          maxWidth: '100%',
          maxHeight: '92vh',
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.1rem',
          padding: '1.75rem',
          color: '#f8fafc'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              background: 'rgba(56, 189, 248, 0.1)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              borderRadius: '10px',
              padding: '0.6rem',
              color: '#38bdf8'
            }}>
              <Laptop size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0, color: '#f8fafc' }}>
                Połączenie Socket & Local Worker
              </h2>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
                Podłącz lokalnego workera przez Socket.IO, aby agenci CLI wykonywali się na Twoim komputerze.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zamknij"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '0.4rem',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Worker Status Badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: workers.length > 0 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.08)',
          border: `1px solid ${workers.length > 0 ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.25)'}`,
          padding: '0.75rem 1rem',
          borderRadius: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            {workers.length > 0 ? (
              <Wifi size={18} style={{ color: '#10b981' }} />
            ) : (
              <WifiOff size={18} style={{ color: '#ef4444' }} />
            )}
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: workers.length > 0 ? '#34d399' : '#f87171' }}>
              {workers.length > 0
                ? `Aktywne połączenie Socket (${workers.length} ${workers.length === 1 ? 'worker połączony' : 'workery połączone'})`
                : 'Brak aktywnego połączenia workera do Socket.IO'}
            </span>
          </div>
          {workers.length > 0 && (
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontFamily: 'var(--mono)' }}>
              {workers.map(w => `${w.name} [${w.platform}]`).join(', ')}
            </span>
          )}
        </div>

        {/* SECTION: AKTUALNY TOKEN DO SOCKETU */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          background: 'rgba(30, 41, 59, 0.45)',
          border: '1px solid #334155',
          borderRadius: '10px',
          padding: '1rem',
        overscrollBehavior: 'contain'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Key size={15} style={{ color: '#f59e0b' }} /> Aktualny Token do Socketu (JWT Auth Token):
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={handleGenerateNewToken}
                disabled={isGeneratingToken}
                title="Generuj nowy 30-dniowy token dedykowany dla workera"
                style={{
                  background: 'rgba(245, 158, 11, 0.1)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  borderRadius: '6px',
                  color: '#f59e0b',
                  fontSize: '0.75rem',
                  padding: '3px 8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem'
                }}
              >
                <RefreshCw size={12} className={isGeneratingToken ? 'animate-spin' : ''} />
                <span>Nowy token 30d</span>
              </button>
              <button
                type="button"
                onClick={() => copyToClipboard(safeToken, setCopiedToken)}
                style={{
                  background: copiedToken ? '#059669' : 'rgba(56, 189, 248, 0.15)',
                  border: `1px solid ${copiedToken ? '#10b981' : 'rgba(56, 189, 248, 0.3)'}`,
                  borderRadius: '6px',
                  color: copiedToken ? '#ffffff' : '#38bdf8',
                  fontSize: '0.75rem',
                  padding: '3px 8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  fontWeight: 600,
                  transition: '0.2s'
                }}
              >
                {copiedToken ? <Check size={12} /> : <Copy size={12} />}
                {copiedToken ? 'Skopiowano token!' : 'Kopiuj token'}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <div style={{
              flex: 1,
              background: '#090d16',
              border: '1px solid #1e293b',
              borderRadius: '8px',
              padding: '0.5rem 0.75rem',
              display: 'flex',
              alignItems: 'center',
              overflow: 'hidden'
            }}>
              <input
                type={showToken ? 'text' : 'password'}
                name="workerToken"
                autoComplete="off"
                spellCheck={false}
                readOnly
                value={safeToken}
                aria-label="Aktualny token do socketu"
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  color: '#38bdf8',
                  fontFamily: 'var(--mono)',
                  fontSize: '0.8rem',
                  outline: 'none',
                  letterSpacing: showToken ? 'normal' : '2px'
                }}
              />
            </div>
            <button
              type="button"
              onClick={() => setShowToken(!showToken)}
              title={showToken ? 'Ukryj token' : 'Pokaż pełny token'}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid #334155',
                borderRadius: '8px',
                padding: '0.5rem',
                color: '#94a3b8',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
            Ten token jest sprawdzany przez middleware Socket.IO przy nawiązaniu połączenia gniazda.
          </span>
        </div>

        {/* Configuration: Server URL & Worker Name */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.75rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <Server size={13} style={{ color: '#38bdf8' }} /> Adres serwera Socket (URL):
            </label>
            <div style={{ display: 'flex', gap: '0.3rem' }}>
              <input
                type="text"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                placeholder="http://localhost:3001"
                style={{
                  flex: 1,
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  padding: '0.45rem 0.65rem',
                  color: '#f8fafc',
                  fontSize: '0.8rem',
                  fontFamily: 'var(--mono)',
                  outline: 'none'
                }}
              />
              <button
                type="button"
                onClick={() => copyToClipboard(serverUrl, setCopiedUrl)}
                title="Kopiuj URL"
                style={{
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  padding: '0.45rem',
                  color: copiedUrl ? '#10b981' : '#94a3b8',
                  cursor: 'pointer'
                }}
              >
                {copiedUrl ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#cbd5e1' }}>
              Nazwa stanowiska (Worker Name):
            </label>
            <input
              type="text"
              value={workerName}
              onChange={(e) => setWorkerName(e.target.value)}
              placeholder="Moj-PC"
              style={{
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '8px',
                padding: '0.45rem 0.65rem',
                color: '#f8fafc',
                fontSize: '0.8rem',
                fontFamily: 'var(--mono)',
                outline: 'none'
              }}
            />
          </div>
        </div>

        {/* SECTION: GOTOWE KOMENDY DO POŁĄCZENIA SOCKET */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Terminal size={15} style={{ color: '#10b981' }} /> Komenda do połączenia Socket:
            </span>
          </div>

          {/* Format Tabs */}
          <div style={{ display: 'flex', gap: '0.3rem', background: '#090d16', padding: '3px', borderRadius: '8px', border: '1px solid #1e293b' }}>
            {[
              { id: 'npm', label: 'NPM (Zalecane)' },
              { id: 'node', label: 'Node Skrypt' },
              { id: 'bash', label: 'Bash / Linux' },
              { id: 'powershell', label: 'PowerShell' }
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setCommandTab(tab.id as any)}
                style={{
                  flex: 1,
                  background: commandTab === tab.id ? '#2563eb' : 'transparent',
                  color: commandTab === tab.id ? '#ffffff' : '#94a3b8',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '4px 8px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: '0.15s'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Command Output Box */}
          <div style={{
            position: 'relative',
            background: '#090d16',
            border: '1px solid #1e293b',
            borderRadius: '10px',
            padding: '0.85rem 1rem',
            overflowX: 'auto'
          }}>
            <pre style={{
              margin: 0,
              fontSize: '0.8rem',
              fontFamily: 'var(--mono)',
              color: '#34d399',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              lineHeight: 1.5
            }}>
              {currentCommand}
            </pre>
          </div>

          <button
            type="button"
            onClick={() => copyToClipboard(currentCommand, setCopiedCmd)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              background: copiedCmd ? '#059669' : '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '0.65rem 1rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background 0.2s ease',
              marginTop: '0.15rem'
            }}
          >
            {copiedCmd ? <Check size={16} /> : <Copy size={16} />}
            {copiedCmd ? 'Skopiowano komendę połączenia!' : 'Kopiuj wybraną komendę do schowka'}
          </button>
        </div>

        {/* Security / How It Works Box */}
        <div style={{
          display: 'flex',
          gap: '0.75rem',
          background: 'rgba(30, 41, 59, 0.4)',
          border: '1px solid rgba(51, 65, 85, 0.5)',
          borderRadius: '8px',
          padding: '0.75rem',
          fontSize: '0.75rem',
          color: '#94a3b8',
          lineHeight: 1.4
        }}>
          <ShieldCheck size={18} style={{ color: '#10b981', flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong>Instrukcja:</strong> Wklej powyższe polecenie w terminalu na komputerze dewelopera (w katalogu projektu).
            Gdy worker zestawi połączenie Socket.IO, w dashboardzie pojawi się zielona ikona, a polecenia agentów (Claude Code, Antigravity, skrypty) uruchomią się bezpośrednio na Twoim PC z podglądem na żywo w przeglądarce.
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
