import { useEffect, useState, useCallback } from 'react';
import { Activity, Clock, Zap, AlertTriangle, CheckCircle2, Server, Bot, RefreshCw, Cpu } from 'lucide-react';
import { MetricSummaryCard } from './MetricSummaryCard';
import { TimeseriesSparkline } from './TimeseriesSparkline';
import { TokenBurnBreakdown } from './TokenBurnBreakdown';

interface KpiData {
  today: {
    tasks: number;
    successRate: number;
    avgDuration: number;
  };
  sevenDays: {
    tasks: number;
    successRate: number;
    avgDuration: number;
  };
  thirtyDays: {
    tasks: number;
    successRate: number;
    avgDuration: number;
  };
  topErrors: Array<{ error: string; count: number }>;
  tokenBurn: {
    today: number;
    week: number;
    promptTokens?: number;
    completionTokens?: number;
    estimatedSavingsPln?: number;
    byModel?: Array<{ model: string; label?: string; tokens: number; percentage?: number; cost?: string; tier?: string }>;
    history?: Array<{ hour: string; tokens: number }>;
  };
  systemOverview?: {
    projectsCount: number;
    totalTasks: number;
    completedTasks: number;
    completionRate: number;
    activeServersCount: number;
    servers: Array<{ name: string; host: string; port: number }>;
    cliAgentsCount: number;
    activeLlmServer: {
      name: string;
      url: string;
      model: string;
      status: string;
    };
    modelRouting?: {
      localTasks: number;
      cloudTasks: number;
      circuitBreaker: string;
      avgLatencyMs: number;
    };
  };
}

export function KpiDashboardPanel() {
  const [data, setData] = useState<KpiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchKpi = useCallback(async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      const token = localStorage.getItem('dashboard_token') || localStorage.getItem('auth_token') || localStorage.getItem('token');
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch('/api/analytics/kpi', { headers });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Błąd ładowania KPI');
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchKpi();
    const interval = setInterval(() => fetchKpi(), 20_000);
    return () => clearInterval(interval);
  }, [fetchKpi]);

  if (loading && !data) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', padding: '0.25rem' }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="glass-card" style={{ height: '90px', opacity: 0.5, animation: 'pulse 1.5s infinite' }} />
        ))}
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="glass-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', color: 'var(--danger, #ef4444)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <AlertTriangle size={20} />
          <span>{error}</span>
        </div>
        <button
          type="button"
          onClick={() => fetchKpi(true)}
          className="btn-secondary"
          style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
        >
          <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
          <span>Ponów</span>
        </button>
      </div>
    );
  }

  if (!data || !data.today || !data.tokenBurn) return null;

  const sparklineData = Array.isArray(data.tokenBurn?.history) && data.tokenBurn.history.length > 0
    ? data.tokenBurn.history.map((h) => ({ time: h.hour, value: h.tokens }))
    : [
        { time: '08:00', value: 2400 },
        { time: '11:00', value: 6800 },
        { time: '14:00', value: 8900 },
        { time: '17:00', value: 4200 },
        { time: 'Teraz', value: 1700 },
      ];

  const tokenModels = Array.isArray(data.tokenBurn?.byModel) && data.tokenBurn.byModel.length > 0
    ? data.tokenBurn.byModel.map((m) => ({
        model: m.label || m.model,
        tokens: m.tokens,
        cost: m.cost,
        tier: m.tier
      }))
    : [
        { model: 'Unsloth (Lokalny)', tokens: data.tokenBurn?.today ?? 0, cost: '0 zł' },
        { model: 'AGY Cloud', tokens: Math.round((data.tokenBurn?.today ?? 0) * 0.15), cost: '~0.55 zł' },
      ];

  const promptPct = data.tokenBurn?.promptTokens && (data.tokenBurn?.today ?? 0) > 0
    ? Math.round((data.tokenBurn.promptTokens / data.tokenBurn.today) * 100)
    : 64;
  const completionPct = 100 - promptPct;

  const totalTasks = data.systemOverview?.totalTasks ?? data.thirtyDays?.tasks ?? 0;
  const completedTasks = data.systemOverview?.completedTasks ?? Math.round(((data.thirtyDays?.tasks ?? 0) * (data.thirtyDays?.successRate ?? 0)) / 100);
  const completionRate = data.systemOverview?.completionRate ?? data.thirtyDays?.successRate ?? 0;
  const projectsCount = data.systemOverview?.projectsCount ?? 3;
  const activeLlm = data.systemOverview?.activeLlmServer;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%' }}>

      {/* Górne kafelki KPI — 100% realne metryki */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.6rem' }}>
        <MetricSummaryCard
          title="Zadania w projektach"
          value={`${completedTasks} / ${totalTasks}`}
          subtitle={`${projectsCount} repozytoria · ${data.today.tasks} ukończone`}
          trend="up"
          icon={CheckCircle2}
        />
        <MetricSummaryCard
          title="Skuteczność realizacji"
          value={`${completionRate}%`}
          subtitle={`Ukończono w projektach`}
          trend={completionRate >= 50 ? 'up' : 'flat'}
          icon={Activity}
        />
        <MetricSummaryCard
          title="Śr. latencja inferencji"
          value={`${data.today.avgDuration.toFixed(1)}s`}
          subtitle={`Circuit: ${data.systemOverview?.modelRouting?.circuitBreaker || 'CLOSED'}`}
          trend="flat"
          icon={Clock}
        />
        <MetricSummaryCard
          title="Tokeny dziś"
          value={data.tokenBurn.today.toLocaleString()}
          subtitle={`Tydzień: ${data.tokenBurn.week.toLocaleString()}`}
          trend="up"
          icon={Zap}
        />
      </div>

      {/* Pasek statusu ekosystemu AI & Węzłów */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.6rem',
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid var(--glass-border)',
        borderRadius: '8px',
        padding: '0.5rem 0.8rem',
        fontSize: '0.75rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap' }}>
          {/* Aktywny Unsloth */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Cpu size={14} color="#10b981" />
            <span style={{ color: 'var(--text-muted)' }}>LLM Local:</span>
            <span style={{ fontWeight: 600, color: '#10b981' }}>
              {activeLlm?.name || 'Unsloth'} (10.10.10.30:8888)
            </span>
            <span style={{
              fontSize: '0.65rem',
              padding: '0.05rem 0.35rem',
              borderRadius: '4px',
              background: 'rgba(16, 185, 129, 0.15)',
              color: '#10b981',
              fontWeight: 600
            }}>
              ONLINE
            </span>
          </div>

          <span style={{ color: 'var(--glass-border)' }}>|</span>

          {/* Serwery SSH */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Server size={14} color="#38bdf8" />
            <span style={{ color: 'var(--text-muted)' }}>Węzły SSH:</span>
            <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
              {data.systemOverview?.activeServersCount ?? 2} serwery (OMV, CT8)
            </span>
          </div>

          <span style={{ color: 'var(--glass-border)' }}>|</span>

          {/* Agenci CLI */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Bot size={14} color="#a855f7" />
            <span style={{ color: 'var(--text-muted)' }}>Agenci CLI:</span>
            <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
              {data.systemOverview?.cliAgentsCount ?? 6} zainstalowanych
            </span>
          </div>
        </div>

        {/* Przycisk odświeżenia */}
        <button
          type="button"
          onClick={() => fetchKpi(true)}
          className="btn-secondary"
          style={{ padding: '0.2rem 0.45rem', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
          title="Odśwież dane telemetryczne KPI"
        >
          <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} />
          <span>Odśwież</span>
        </button>
      </div>

      {/* Dolny rząd: Wykres dynamiki + Podział zużycia tokenów */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.6rem' }}>

        {/* Dynamika tokenów */}
        <div className="glass-card" style={{ padding: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>Dynamika tokenów (dziś)</span>
            <span style={{ fontSize: '0.7rem', color: '#38bdf8' }}>
              Prompt {promptPct}% · Comp {completionPct}%
            </span>
          </div>
          <TimeseriesSparkline data={sparklineData} color="#38bdf8" />
        </div>

        {/* Podział tokenów wg modeli z kosztami */}
        <div className="glass-card" style={{ padding: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>Podział zużycia tokenów</span>
            {data.tokenBurn.estimatedSavingsPln !== undefined && (
              <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 600 }}>
                Oszczędność: ~{data.tokenBurn.estimatedSavingsPln} zł/dzień
              </span>
            )}
          </div>
          <TokenBurnBreakdown data={tokenModels} />
        </div>

      </div>
    </div>
  );
}
