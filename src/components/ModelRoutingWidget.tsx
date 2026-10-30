import React, { useState, useEffect, useCallback } from 'react';
import { Cpu, Cloud, Zap, ArrowRight, ShieldCheck, RefreshCw, AlertTriangle } from 'lucide-react';

interface ModelRoutingStats {
  localTasks: number;
  cloudTasks: number;
  circuitBreakerState: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  primaryLocalModel: string;
  fallbackLocalModel: string;
  cloudModel: string;
  avgLocalLatencyMs: number;
  avgCloudLatencyMs: number;
  localEndpoint?: string;
  fallbackCount?: number;
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
  fallbackCount: 0,
};

export function ModelRoutingWidget() {
  const [stats, setStats] = useState<ModelRoutingStats>(DEFAULT_STATS);
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const token = typeof window !== 'undefined' ? (localStorage.getItem('dashboard_token') || localStorage.getItem('auth_token')) : null;
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch('/api/llm/routing/stats', { headers });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      setStats(data);
      setError(null);
    } catch (err: unknown) {
      // Keep baseline/previous state and display subtle error notice
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

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 15_000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  const total = stats.localTasks + stats.cloudTasks;
  const localRatio = total > 0 ? Math.round((stats.localTasks / total) * 100) : 0;
  const isCircuitOpen = stats.circuitBreakerState === 'OPEN';

  return (
    <div className="glass-card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Zap size={18} color="var(--primary, #38bdf8)" />
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
            Inteligentny Routing Modeli (T5)
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
                ? 'Obwód zamknięty (stan prawidłowy: zapytania płyną bezpośrednio do lokalnego LLM)'
                : isCircuitOpen
                ? 'Obwód otwarty (awaryjny: zapytania są przekierowywane do chmury)'
                : 'Obwód w fazie testowej (sprawdzanie dostępności lokalnego LLM)'
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
        {/* Local Tier */}
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Tier Low / Medium (Local)</span>
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
          <span style={{ fontSize: '0.7rem', color: '#10b981' }}>
            Śr. czas: ~{stats.avgLocalLatencyMs}ms (0 zł)
          </span>
        </div>

        {/* Cloud Tier */}
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Tier High (Cloud / AGY)</span>
            <Cloud size={14} color="#818cf8" />
          </div>
          <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#818cf8' }}>
            {100 - localRatio}% <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-muted)' }}>({stats.cloudTasks} zadań)</span>
          </span>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            Model: <code style={{ color: '#818cf8' }}>{stats.cloudModel}</code>
          </span>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            Złożone: Refactoring, Architektura
          </span>
          <span style={{ fontSize: '0.7rem', color: '#818cf8' }}>
            Śr. czas: ~{stats.avgCloudLatencyMs}ms
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', paddingTop: '0.25rem' }}>
        <span>Przepływ:</span>
        <code>Zapytanie</code>
        <ArrowRight size={12} />
        <code>Scorer (low/med/high)</code>
        <ArrowRight size={12} />
        <code>{stats.localEndpoint ? `${stats.localEndpoint.replace(/^http:\/\//, '').replace(/\/v1$/, '')} (LM Studio)` : '10.10.10.30:1234 (LM Studio)'} / AGY</code>
      </div>
    </div>
  );
}
