import React, { useEffect, useState } from 'react';
import { Activity, CheckCircle, Clock, Zap, AlertTriangle, Info } from 'lucide-react';
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
  };
  sparkline?: Array<{ time: string; value: number }>;
}

export function KpiDashboardPanel() {
  const [data, setData] = useState<KpiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function fetchKpi() {
      try {
        const token = localStorage.getItem('dashboard_token');
        const headers: Record<string, string> = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        const res = await fetch('/api/analytics/kpi', { headers });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const json = await res.json();
        if (isMounted) {
          setData(json);
          setLoading(false);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Błąd ładowania KPI');
          setLoading(false);
        }
      }
    }
    fetchKpi();
    const interval = setInterval(fetchKpi, 30_000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', padding: '0.5rem' }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="glass-card" style={{ height: '90px', opacity: 0.5, animation: 'pulse 1.5s infinite' }} />
        ))}
      </div>
    );
  }

  if (error || !data || !data.today || !data.sevenDays || !data.tokenBurn) {
    return (
      <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', color: 'var(--danger, #ef4444)' }}>
        <AlertTriangle size={20} />
        <span>{error || 'Brak danych KPI'}</span>
      </div>
    );
  }

  const sparklineData = data.sparkline && data.sparkline.length > 0
    ? data.sparkline
    : [
        { time: '6d', value: 0 },
        { time: '5d', value: 0 },
        { time: '4d', value: 0 },
        { time: '3d', value: 0 },
        { time: '2d', value: 0 },
        { time: '1d', value: 0 },
        { time: 'dziś', value: 0 },
      ];

  const tokenModels = [
    { model: 'Dzisiaj', tokens: data.tokenBurn.today },
    { model: 'Tydzień', tokens: data.tokenBurn.week },
  ];

  const isZeroActivity = data.today.tasks === 0 && data.sevenDays.tasks === 0 && data.tokenBurn.today === 0;

  return (
    <div className="tabular-nums" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', fontVariantNumeric: 'tabular-nums' }}>
      {isZeroActivity && (
        <div
          className="glass-card"
          style={{
            padding: '0.6rem 1rem',
            fontSize: '0.8rem',
            color: 'var(--text-muted, #94a3b8)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            borderLeft: '3px solid var(--primary, #38bdf8)'
          }}
        >
          <Info size={16} className="shrink-0 text-sky-400" aria-hidden="true" />
          <span>Brak aktywności agentów w ostatnim okresie. Uruchom agenta, aby zebrać rzeczywiste dane telemetrii i zużycia tokenów.</span>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
        <MetricSummaryCard
          title="Zadania dziś"
          value={data.today.tasks}
          subtitle={`7 dni: ${data.sevenDays.tasks}`}
          trend={data.today.tasks > 0 ? 'up' : 'flat'}
          icon={Activity}
        />
        <MetricSummaryCard
          title="Skuteczność"
          value={`${Math.round(data.today.successRate)}%`}
          subtitle={`7 dni: ${Math.round(data.sevenDays.successRate)}%`}
          trend={data.today.successRate >= 80 ? 'up' : 'flat'}
          icon={CheckCircle}
        />
        <MetricSummaryCard
          title="Czas średni"
          value={`${data.today.avgDuration.toFixed(1)}s`}
          subtitle={`7 dni: ${data.sevenDays.avgDuration.toFixed(1)}s`}
          trend="flat"
          icon={Clock}
        />
        <MetricSummaryCard
          title="Tokeny dziś"
          value={data.tokenBurn.today.toLocaleString()}
          subtitle={`Tydzień: ${data.tokenBurn.week.toLocaleString()}`}
          trend={data.tokenBurn.today > 0 ? 'up' : 'flat'}
          icon={Zap}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem' }}>
        <div className="glass-card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Dynamika zadań (ostatnie 7 dni)</span>
          <TimeseriesSparkline data={sparklineData} color="var(--primary, #38bdf8)" />
        </div>
        <div className="glass-card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Podział zużycia tokenów</span>
          <TokenBurnBreakdown data={tokenModels} />
        </div>
      </div>
    </div>
  );
}
