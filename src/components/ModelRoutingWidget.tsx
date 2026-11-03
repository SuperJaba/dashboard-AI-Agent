import React, { useState, useEffect, useCallback } from 'react';
import { Cpu, Cloud, Zap, ArrowRight, ShieldCheck, RefreshCw, AlertTriangle, Play, CheckCircle, ExternalLink, Activity } from 'lucide-react';
import { useDashboardSocket } from '../hooks/useDashboardSocket';

interface CallRecord {
  id: string;
  timestamp: string;
  tier: 'low' | 'medium' | 'high';
  provider: string;
  model: string;
  durationMs: number;
  success: boolean;
  promptPreview: string;
}

interface ModelRoutingStats {
  localTasks: number;
  cloudTasks: number;
  fallbackTasks?: number;
  circuitBreakerState: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failureCount?: number;
  primaryLocalModel: string;
  fallbackLocalModel: string;
  cloudModel: string;
  localServerName?: string;
  localUrl?: string;
  localEndpoint?: string;
  avgLocalLatencyMs: number;
  avgCloudLatencyMs: number;
  fallbackCount?: number;
  recentCalls?: CallRecord[];
}

const DEFAULT_STATS: ModelRoutingStats = {
  localTasks: 84,
  cloudTasks: 16,
  circuitBreakerState: 'CLOSED',
  primaryLocalModel: 'openai/gpt-oss-20b',
  fallbackLocalModel: 'granite-4.0-micro',
  cloudModel: 'AGY (Gemini Pro)',
  avgLocalLatencyMs: 380,
  avgCloudLatencyMs: 1450,
  localEndpoint: 'http://10.10.10.30:1234/v1',
  localServerName: 'Unsloth',
  fallbackCount: 0,
};

export function ModelRoutingWidget() {
  const [stats, setStats] = useState<ModelRoutingStats>(DEFAULT_STATS);
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const token = typeof window !== 'undefined' ? (localStorage.getItem('dashboard_token') || localStorage.getItem('auth_token')) : null;
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      // Try /api/llm/routing/stats first, then /api/llm/routing-stats
      let res = await fetch('/api/llm/routing/stats', { headers });
      if (!res.ok && res.status === 404) {
        res = await fetch('/api/llm/routing-stats', { headers });
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      setStats(data);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Błąd synchronizacji');
    }
  }, []);

  const handleResetCircuit = async () => {
    try {
      setResetting(true);
      const token = typeof window !== 'undefined' ? (localStorage.getItem('dashboard_token') || localStorage.getItem('auth_token')) : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch('/api/llm/routing/circuit/reset', {
        method: 'POST',
        headers,
      });
      if (res.ok) {
        const json = await res.json();
        if (json.stats) {
          setStats(json.stats);
        }
      }
    } catch (err: unknown) {
      console.error('Failed to reset circuit breaker:', err);
    } finally {
      setResetting(false);
    }
  };

  const handleSimulatePrompt = async (type: 'local' | 'cloud') => {
    setTesting(true);
    setTestResult(null);
    try {
      const token = typeof window !== 'undefined' ? (localStorage.getItem('dashboard_token') || localStorage.getItem('auth_token')) : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const prompt = type === 'local'
        ? 'Formatuj ten tekst json i przygotuj raport'
        : 'Zaprojektuj rozproszoną architekturę mikroserwisów i usuń deadlock transakcji bazodanowych';

      const res = await fetch('/api/llm/route-prompt', {
        method: 'POST',
        headers,
        body: JSON.stringify({ prompt, dryRun: false }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const resData = await res.json();
      if (resData.stats) {
        setStats(resData.stats);
      } else {
        await fetchStats();
      }

      const durationStr = resData.result?.durationMs ? ` (~${resData.result.durationMs}ms)` : '';
      const localName = stats.localServerName || 'Unsloth';
      setTestResult(`Skierowano do: ${type === 'local' ? `${localName} (Lokalny)` : 'AGY Cloud'}${durationStr}`);
      setTimeout(() => setTestResult(null), 3000);
    } catch {
      setTestResult('Błąd podczas testu routingu');
    } finally {
      setTesting(false);
    }
  };

  const { socket } = useDashboardSocket();

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 5_000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  useEffect(() => {
    if (!socket) return;
    const handleDirectStats = (incoming: ModelRoutingStats) => {
      if (incoming) setStats(incoming);
    };
    socket.on('routing:stats', handleDirectStats);
    socket.on('routing:stats_updated', fetchStats);
    socket.on('agent_event', fetchStats);
    return () => {
      socket.off('routing:stats', handleDirectStats);
      socket.off('routing:stats_updated', fetchStats);
      socket.off('agent_event', fetchStats);
    };
  }, [socket, fetchStats]);

  const total = stats.localTasks + stats.cloudTasks;
  const localRatio = total > 0 ? Math.round((stats.localTasks / total) * 100) : 0;
  const cloudRatio = total > 0 ? 100 - localRatio : 0;
  const isCircuitOpen = stats.circuitBreakerState === 'OPEN';

  return (
    <div className="glass-card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%' }}>
      {/* Nagłówek */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Zap size={18} color="var(--primary, #38bdf8)" />
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
            Inteligentny Routing Modeli (Live T5)
          </span>
          <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', fontWeight: 600 }}>
            Aktywny
          </span>
          {error && (
            <span style={{ fontSize: '0.7rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.2rem' }} title={error}>
              <AlertTriangle size={12} />
              <span>offline sync</span>
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.75rem',
              padding: '0.2rem 0.5rem',
              borderRadius: '4px',
              background: isCircuitOpen ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.1)',
              color: isCircuitOpen ? '#ef4444' : stats.circuitBreakerState === 'CLOSED' ? '#10b981' : '#f59e0b',
            }}
            title={
              stats.circuitBreakerState === 'CLOSED'
                ? 'Obwód: SPRAWNY (CLOSED)'
                : isCircuitOpen
                ? 'Obwód: ROZŁĄCZONY (OPEN)'
                : 'Obwód: TEST (HALF-OPEN)'
            }
          >
            <ShieldCheck size={14} />
            <span>
              {stats.circuitBreakerState === 'CLOSED'
                ? 'Obwód: SPRAWNY (CLOSED)'
                : stats.circuitBreakerState === 'OPEN'
                ? 'Obwód: ROZŁĄCZONY (OPEN)'
                : 'Obwód: TEST (HALF-OPEN)'}
            </span>
          </div>

          {isCircuitOpen && (
            <button
              onClick={handleResetCircuit}
              disabled={resetting}
              style={{
                fontSize: '0.7rem',
                padding: '0.2rem 0.5rem',
                borderRadius: '4px',
                background: '#ef4444',
                color: '#fff',
                border: 'none',
                cursor: resetting ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
              title="Zresetuj bezpiecznik obwodu"
            >
              <RefreshCw size={11} className={resetting ? 'animate-spin' : ''} />
              Reset
            </button>
          )}

          <a
            href="http://10.10.10.30:8888/api-monitor"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary"
            style={{ padding: '0.25rem 0.5rem', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#10b981', textDecoration: 'none' }}
            title="Otwórz Unsloth Live Traffic Monitor"
          >
            <Activity size={12} />
            <span>Unsloth</span>
            <ExternalLink size={10} />
          </a>

          <button
            onClick={() => {
              setLoading(true);
              fetchStats().finally(() => setLoading(false));
            }}
            disabled={loading}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: loading ? 'not-allowed' : 'pointer',
              padding: '0.2rem',
              display: 'flex',
              alignItems: 'center',
            }}
            title="Odśwież statystyki routingu"
            aria-label="Odśwież statystyki routingu"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Karty Tierów */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
        {/* Local Tier */}
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Tier Low / Medium ({stats.localServerName || 'Unsloth'} Local)
            </span>
            <Cpu size={14} color="#10b981" />
          </div>
          <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#10b981' }}>
            {localRatio}% <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-muted)' }}>({stats.localTasks} zadań)</span>
          </span>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            Model: <code style={{ color: 'var(--primary)' }}>{stats.primaryLocalModel}</code>
          </span>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            Fallback: <code>{stats.fallbackLocalModel}</code>
          </span>
          <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 600 }}>
            {stats.avgLocalLatencyMs > 0 ? `Śr. czas: ~${stats.avgLocalLatencyMs}ms (0 zł)` : 'Śr. czas: brak wywołań (0 zł)'}
          </span>
        </div>

        {/* Cloud Tier */}
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Tier High (Cloud / AGY)</span>
            <Cloud size={14} color="#818cf8" />
          </div>
          <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#818cf8' }}>
            {cloudRatio}% <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-muted)' }}>({stats.cloudTasks} zadań)</span>
          </span>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            Model: <code style={{ color: '#818cf8' }}>{stats.cloudModel}</code>
          </span>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            Złożone: Refactoring, Architektura
          </span>
          <span style={{ fontSize: '0.7rem', color: '#818cf8', fontWeight: 600 }}>
            {stats.avgCloudLatencyMs > 0 ? `Śr. czas: ~${stats.avgCloudLatencyMs}ms` : 'Śr. czas: brak wywołań'}
          </span>
        </div>
      </div>

      {/* Interaktywny panel testowy na żywo */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', background: 'rgba(0,0,0,0.2)', padding: '0.4rem 0.6rem', borderRadius: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Test na żywo:</span>
          <button
            type="button"
            className="btn-secondary"
            disabled={testing}
            onClick={() => handleSimulatePrompt('local')}
            style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
          >
            <Play size={10} color="#10b981" />
            <span>Test Local ({stats.localServerName || 'Unsloth'})</span>
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={testing}
            onClick={() => handleSimulatePrompt('cloud')}
            style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
          >
            <Play size={10} color="#818cf8" />
            <span>Test Cloud</span>
          </button>
        </div>

        {testResult && (
          <span style={{ fontSize: '0.72rem', color: '#34d399', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <CheckCircle size={12} />
            <span>{testResult}</span>
          </span>
        )}
      </div>

      {/* Wizualizacja przepływu */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
        <span>Przepływ:</span>
        <code>Zapytanie</code>
        <ArrowRight size={12} />
        <code>Scorer (low/med/high)</code>
        <ArrowRight size={12} />
        <code>{stats.localEndpoint ? `${stats.localEndpoint.replace(/^https?:\/\//, '').replace(/\/v1\/?$/, '')} (${stats.localServerName || 'Unsloth'})` : '10.10.10.30:8888 (Unsloth)'} / AGY</code>
      </div>
    </div>
  );
}
