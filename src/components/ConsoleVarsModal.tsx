import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, Copy, Check, Terminal, Key, Eye, EyeOff, RefreshCw, 
  Server, Zap, ShieldCheck, CheckCircle2, AlertCircle, Bot
} from 'lucide-react';
import { apiFetch } from '../shared/api-client';

interface ConsoleVarsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

interface TestResult {
  success: boolean;
  status: string;
  serverType?: string;
  latency?: number | null;
  speed?: number | null;
  loadedModel?: string;
  ip?: string;
  error?: string | null;
}

export function ConsoleVarsModal({ isOpen, onClose, onSaved }: ConsoleVarsModalProps) {
  const [ip, setIp] = useState('http://127.0.0.1:8888/v1');
  const [model, setModel] = useState('unsloth/Qwen3.5-9B-MTP-GGUF');
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'bash' | 'powershell' | 'env'>('bash');
  const [copied, setCopied] = useState(false);

  const [exportCommands, setExportCommands] = useState<{ bash: string; powershell: string; env: string }>({
    bash: '',
    powershell: '',
    env: ''
  });

  const fetchConsoleVars = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/agents/console-vars');
      if (res.ok) {
        const data = await res.json();
        if (data.ip) setIp(data.ip);
        if (data.model) setModel(data.model);
        if (data.token !== undefined) setToken(data.token);
        if (data.exportCommands) setExportCommands(data.exportCommands);
      }
    } catch (e) {
      console.error('Failed to fetch console vars', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchConsoleVars();
      setTestResult(null);
      setNotification(null);
    }
  }, [isOpen, fetchConsoleVars]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    setNotification(null);
    try {
      const res = await apiFetch('/api/agents/console-vars', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip, model, token })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNotification({ type: 'success', message: 'Zmienne konsoli zapisane pomyślnie w bazie danych!' });
        if (data.exportCommands) setExportCommands(data.exportCommands);
        if (onSaved) onSaved();
      } else {
        setNotification({ type: 'error', message: data.error || 'Nie udało się zapisać zmiennych.' });
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Błąd sieci podczas zapisu.' });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await apiFetch('/api/agents/console-vars/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip, model, token })
      });
      const data = await res.json();
      setTestResult(data);
      if (data.success && data.loadedModel && data.loadedModel !== 'Brak') {
        // Offer or auto-align model if user had default
        if (!model || model === 'gpt-4o' || model.includes('qwen35-4b')) {
          setModel(data.loadedModel);
        }
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        status: 'offline',
        error: err.message || 'Błąd połączenia'
      });
    } finally {
      setTesting(false);
    }
  };

  const handleAutofillLocal = () => {
    setIp('http://127.0.0.1:8888/v1');
    setModel('unsloth/Qwen3.5-9B-MTP-GGUF');
    setToken('');
  };

  const currentExport = exportCommands[activeTab] || '';

  const copyToClipboard = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '1rem'
      }}
    >
      <div
        className="modal-content animate-in"
        style={{
          background: 'var(--bg-card, #0f172a)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '16px',
          padding: '1.75rem',
          maxWidth: '680px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          position: 'relative',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 30px rgba(124, 58, 237, 0.15)'
        }}
      >
        <button
          onClick={onClose}
          className="modal-close-btn"
          aria-label="Zamknij"
          style={{
            position: 'absolute',
            top: '1.25rem',
            right: '1.25rem',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted, #94a3b8)',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '6px'
          }}
        >
          <X size={20} />
        </button>

        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <div
            style={{
              background: 'rgba(124, 58, 237, 0.15)',
              border: '1px solid rgba(124, 58, 237, 0.3)',
              borderRadius: '12px',
              padding: '0.6rem',
              color: '#a855f7'
            }}
          >
            <Terminal size={24} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
              Zmienne Konsoli CLI Agenta
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '0.2rem 0 0' }}>
              Skonfiguruj IP serwera LLM, aktywny model i token dostępowy. Dane są zapisywane w bazie danych.
            </p>
          </div>
        </div>

        {/* Notification Banner */}
        {notification && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.65rem 0.85rem',
              borderRadius: '8px',
              fontSize: '0.8rem',
              marginBottom: '1rem',
              background: notification.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              border: `1px solid ${notification.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
              color: notification.type === 'success' ? '#34d399' : '#f87171'
            }}
          >
            {notification.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{notification.message}</span>
          </div>
        )}

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* IP / URL Field */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Server size={14} color="#38bdf8" /> Adres IP / URL Serwera LLM
              </label>
              <button
                type="button"
                onClick={handleAutofillLocal}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#38bdf8',
                  fontSize: '0.72rem',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  padding: 0
                }}
              >
                Ustaw lokalny (127.0.0.1:8888)
              </button>
            </div>
            <input
              type="text"
              name="consoleIp"
              required
              value={ip}
              onChange={(e) => setIp(e.target.value)}
              placeholder="http://127.0.0.1:8888/v1"
              style={{
                width: '100%',
                background: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
                borderRadius: '8px',
                padding: '0.6rem 0.75rem',
                color: '#f8fafc',
                fontSize: '0.85rem',
                fontFamily: 'monospace',
                outline: 'none'
              }}
            />
          </div>

          {/* Model Field */}
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.35rem' }}>
              <Bot size={14} color="#a855f7" /> Model LLM
            </label>
            <input
              type="text"
              name="consoleModel"
              required
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="unsloth/Qwen3.5-9B-MTP-GGUF"
              style={{
                width: '100%',
                background: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
                borderRadius: '8px',
                padding: '0.6rem 0.75rem',
                color: '#f8fafc',
                fontSize: '0.85rem',
                fontFamily: 'monospace',
                outline: 'none'
              }}
            />
          </div>

          {/* Token Field */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Key size={14} color="#f59e0b" /> Token / API Key
              </label>
              <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                Opcjonalny dla lokalnego Unsloth / LM Studio
              </span>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                type={showToken ? 'text' : 'password'}
                name="consoleToken"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="np. sk-local lub token serwera"
                style={{
                  width: '100%',
                  background: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
                  borderRadius: '8px',
                  padding: '0.6rem 2.5rem 0.6rem 0.75rem',
                  color: '#f8fafc',
                  fontSize: '0.85rem',
                  fontFamily: 'monospace',
                  outline: 'none'
                }}
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                style={{
                  position: 'absolute',
                  right: '0.65rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '4px'
                }}
                title={showToken ? 'Ukryj' : 'Pokaż'}
              >
                {showToken ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* Action Buttons: Test Connection & Save to DB */}
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
            <button
              type="button"
              onClick={handleTest}
              disabled={testing || loading}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                background: 'rgba(56, 189, 248, 0.12)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                borderRadius: '8px',
                padding: '0.6rem 1rem',
                color: '#38bdf8',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {testing ? <RefreshCw size={15} className="animate-spin" /> : <Zap size={15} />}
              <span>{testing ? 'Testowanie połączenia…' : 'Testuj połączenie'}</span>
            </button>

            <button
              type="submit"
              disabled={saving || loading}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                background: '#2563eb',
                border: 'none',
                borderRadius: '8px',
                padding: '0.6rem 1rem',
                color: '#ffffff',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {saving ? <RefreshCw size={15} className="animate-spin" /> : <Check size={15} />}
              <span>{saving ? 'Zapisywanie…' : 'Zapisz do bazy danych'}</span>
            </button>
          </div>
        </form>

        {/* Live Test Results Card */}
        {testResult && (
          <div
            style={{
              marginTop: '1.25rem',
              padding: '0.85rem',
              borderRadius: '10px',
              background: testResult.success ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
              border: `1px solid ${testResult.success ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontWeight: 700, fontSize: '0.85rem', color: testResult.success ? '#34d399' : '#f87171', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                {testResult.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                {testResult.success ? `Połączono pomyślnie (${testResult.serverType || 'Online'})` : 'Błąd połączenia z serwerem'}
              </span>
              <span
                style={{
                  fontSize: '0.7rem',
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  background: testResult.success ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                  color: testResult.success ? '#34d399' : '#f87171',
                  fontWeight: 600
                }}
              >
                {testResult.status === 'success' ? 'Online' : 'Offline'}
              </span>
            </div>

            {testResult.success ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', fontSize: '0.75rem', color: '#cbd5e1' }}>
                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.4rem 0.6rem', borderRadius: '6px' }}>
                  <div style={{ color: '#94a3b8', fontSize: '0.7rem' }}>Opóźnienie (TTFT)</div>
                  <div style={{ fontWeight: 700, color: '#f8fafc', marginTop: '2px' }}>
                    {testResult.latency !== null ? `${testResult.latency} ms` : '--'}
                  </div>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.4rem 0.6rem', borderRadius: '6px' }}>
                  <div style={{ color: '#94a3b8', fontSize: '0.7rem' }}>Przepustowość</div>
                  <div style={{ fontWeight: 700, color: '#f8fafc', marginTop: '2px' }}>
                    {testResult.speed !== null ? `${testResult.speed} t/s` : '--'}
                  </div>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.4rem 0.6rem', borderRadius: '6px' }}>
                  <div style={{ color: '#94a3b8', fontSize: '0.7rem' }}>Załadowany model</div>
                  <div style={{ fontWeight: 700, color: '#a855f7', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {testResult.loadedModel || 'Brak'}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: '0.75rem', color: '#fca5a5' }}>
                {testResult.error || 'Nie udało się połączyć pod wskazanym adresem IP.'}
              </div>
            )}
          </div>
        )}

        {/* Export Commands Section */}
        <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Terminal size={14} color="#10b981" /> Gotowe polecenia eksportu do terminala:
            </span>
          </div>

          {/* Format Tabs */}
          <div style={{ display: 'flex', gap: '0.25rem', background: 'rgba(0,0,0,0.3)', padding: '2px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
            {[
              { id: 'bash', label: 'Bash / Zsh' },
              { id: 'powershell', label: 'PowerShell' },
              { id: 'env', label: '.env format' }
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  flex: 1,
                  background: activeTab === tab.id ? '#2563eb' : 'transparent',
                  color: activeTab === tab.id ? '#ffffff' : '#94a3b8',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '4px 8px',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Snippet Display */}
          <div
            style={{
              position: 'relative',
              background: 'rgba(0, 0, 0, 0.45)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '8px',
              padding: '0.75rem 0.9rem',
              overflowX: 'auto'
            }}
          >
            <pre
              style={{
                margin: 0,
                fontSize: '0.75rem',
                fontFamily: 'monospace',
                color: '#34d399',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                lineHeight: 1.5
              }}
            >
              {currentExport}
            </pre>
          </div>

          <button
            type="button"
            onClick={() => copyToClipboard(currentExport)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              background: copied ? '#10b981' : 'rgba(255, 255, 255, 0.08)',
              color: '#ffffff',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '8px',
              padding: '0.55rem',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background 0.2s'
            }}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            <span>{copied ? 'Skopiowano polecenia do schowka!' : 'Kopiuj polecenia do schowka'}</span>
          </button>
        </div>

        {/* Info Box */}
        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            background: 'rgba(30, 41, 59, 0.35)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '8px',
            padding: '0.65rem',
            fontSize: '0.72rem',
            color: '#94a3b8',
            marginTop: '1rem',
            lineHeight: 1.4
          }}
        >
          <ShieldCheck size={16} color="#34d399" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            Zapisanie zmiennych natychmiast aktualizuje bazę danych oraz konfigurację środowiska dla agentów CLI (Codex, Claude Code, Aider, OpenCode) i Diagnostyki LLM Server.
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
