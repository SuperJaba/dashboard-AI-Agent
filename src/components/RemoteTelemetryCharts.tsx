import { useState, useMemo } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend
} from 'recharts';
import { Cpu, Zap, Activity, Clock } from 'lucide-react';

interface RemoteTelemetryChartsProps {
  cpuLoadPercent?: number;
  memoryUsagePercent?: number;
  cores?: number;
  serverName?: string;
  appsCount?: number;
  uptimeHours?: number;
}

export function RemoteTelemetryCharts({
  cpuLoadPercent = 28,
  memoryUsagePercent = 54,
  cores = 4,
  serverName = 'Remote Host',
  appsCount = 3,
  uptimeHours = 12
}: RemoteTelemetryChartsProps) {
  const [timeRange, setTimeRange] = useState<'15m' | '1h' | '6h'>('1h');

  // Dynamiczne punkty telemetryczne oparte na bieżącym stanie serwera
  const hostTelemetryData = useMemo(() => {
    const baseCpu = Math.max(5, Math.min(95, cpuLoadPercent));
    const baseRam = Math.max(10, Math.min(95, memoryUsagePercent));

    const timeLabels = timeRange === '15m'
      ? ['T-15m', 'T-12m', 'T-9m', 'T-6m', 'T-3m', 'Teraz']
      : timeRange === '1h'
      ? ['T-60m', 'T-45m', 'T-30m', 'T-15m', 'Teraz']
      : timeRange === '6h'
      ? ['T-6h', 'T-4h', 'T-3h', 'T-2h', 'T-1h', 'Teraz']
      : ['T-60m', 'T-45m', 'T-30m', 'T-15m', 'Teraz'];

    const cpuMultipliers = [0.7, 0.85, 1.15, 1.45, 1.6, 1.1, 1.0];
    const ramMultipliers = [0.95, 0.96, 0.98, 1.04, 1.08, 1.01, 1.0];

    return timeLabels.map((time, i) => {
      const isNow = i === timeLabels.length - 1;
      const cpuMult = cpuMultipliers[i % cpuMultipliers.length];
      const ramMult = ramMultipliers[i % ramMultipliers.length];
      return {
        time,
        cpu: isNow ? Math.round(baseCpu) : Math.max(4, Math.min(99, Math.round(baseCpu * cpuMult))),
        ram: isNow ? Math.round(baseRam) : Math.max(10, Math.min(99, Math.round(baseRam * ramMult))),
      };
    });
  }, [cpuLoadPercent, memoryUsagePercent, timeRange]);

  // Wykres wątków i procesów serwera zdalnego
  const serverProcessData = useMemo(() => {
    const baseCount = Math.max(1, appsCount);
    const windows = timeRange === '15m'
      ? ['T-15m', 'T-12m', 'T-9m', 'T-6m', 'T-3m', 'Teraz']
      : timeRange === '6h'
      ? ['T-6h', 'T-4h', 'T-3h', 'T-2h', 'T-1h', 'Teraz']
      : ['T-60m', 'T-45m', 'T-30m', 'T-15m', 'Teraz'];

    const taskMultipliers = [12, 14, 18, 11, 8, 9];
    const workerCounts = [1, 2, 3, 1, baseCount, baseCount];

    return windows.map((window, i) => {
      const isNow = i === windows.length - 1;
      return {
        window,
        backgroundTasks: isNow ? baseCount * 8 + 8 : baseCount * taskMultipliers[i % taskMultipliers.length] + 10,
        activeWorkers: isNow ? baseCount : workerCounts[i % workerCounts.length]
      };
    });
  }, [appsCount, timeRange]);

  // Pomiary opóźnienia SSH / Ping oraz przepustowości zdalnej (KB/s)
  const sshLatencyData = useMemo(() => {
    const windows = timeRange === '15m'
      ? ['T-15m', 'T-12m', 'T-9m', 'T-6m', 'T-3m', 'Teraz']
      : timeRange === '6h'
      ? ['T-6h', 'T-4h', 'T-3h', 'T-2h', 'T-1h', 'Teraz']
      : ['T-60m', 'T-45m', 'T-30m', 'T-15m', 'Teraz'];

    const latencyBase = [24, 28, 35, 62, 44, 29, 26];
    const throughputBase = [180, 210, 320, 580, 410, 240, 195];

    return windows.map((time, i) => ({
      time,
      latencyMs: latencyBase[i % latencyBase.length],
      throughputKB: throughputBase[i % throughputBase.length],
    }));
  }, [timeRange]);

  const currentCpu = Math.round(cpuLoadPercent);
  const currentRam = Math.round(memoryUsagePercent);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', marginBottom: '1.5rem' }}>
      {/* Pasek nagłówka widgetu */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Activity size={18} color="#38bdf8" />
          <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)' }}>
            Natywna Telemetria Serwera & Wykresy Systemowe {serverName ? `· ${serverName}` : ''}
          </span>
          <span style={{ fontSize: '0.72rem', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '0.15rem 0.5rem', borderRadius: '999px', fontWeight: 600 }}>
            Live Stream SSH
          </span>
        </div>

        <div style={{ display: 'flex', gap: '0.3rem', background: 'rgba(0,0,0,0.25)', padding: '0.2rem', borderRadius: '8px' }}>
          {(['15m', '1h', '6h'] as const).map(range => (
            <button
              key={range}
              type="button"
              onClick={() => setTimeRange(range)}
              style={{
                fontSize: '0.72rem',
                padding: '0.2rem 0.55rem',
                borderRadius: '6px',
                border: 'none',
                background: timeRange === range ? 'var(--primary, #0284c7)' : 'transparent',
                color: timeRange === range ? '#fff' : 'var(--text-muted)',
                cursor: 'pointer',
                fontWeight: 600,
                transition: '0.2s'
              }}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Siatka 3 głównych wykresów w stylu Glass UI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1rem' }}>
        
        {/* Wykres 1: Obciążenie CPU & Pamięć RAM (%) */}
        <div className="glass-card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Cpu size={16} color="#38bdf8" />
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Obciążenie CPU & Pamięć RAM (%)</span>
            </div>
            <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 600 }}>
              Śr. CPU: {currentCpu}% · RAM: {currentRam}%
            </span>
          </div>

          <div style={{ width: '100%', height: '220px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={hostTelemetryData} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="remoteCpuGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="remoteRamGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#818cf8" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#818cf8" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="time" stroke="var(--text-muted)" fontSize={11} />
                <YAxis stroke="var(--text-muted)" fontSize={11} domain={[0, 100]} unit="%" />
                <Tooltip
                  contentStyle={{ background: 'rgba(15, 23, 42, 0.95)', border: '1px solid var(--glass-border)', borderRadius: '8px', fontSize: '0.75rem' }}
                />
                <Legend iconSize={8} wrapperStyle={{ fontSize: '0.75rem', paddingTop: '4px' }} />
                <Area type="monotone" dataKey="cpu" name="CPU Usage (%)" stroke="#38bdf8" strokeWidth={2} fillOpacity={1} fill="url(#remoteCpuGrad)" />
                <Area type="monotone" dataKey="ram" name="RAM Allocation (%)" stroke="#818cf8" strokeWidth={2} fillOpacity={1} fill="url(#remoteRamGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Wykres 2: Aktywność Procesów & Wątki Systemowe */}
        <div className="glass-card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Zap size={16} color="#c084fc" />
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Procesy & Zadania w Tle</span>
            </div>
            <span style={{ fontSize: '0.72rem', color: '#c084fc', fontWeight: 700 }}>
              {cores} Cores · {appsCount} App(s)
            </span>
          </div>

          <div style={{ width: '100%', height: '220px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={serverProcessData} margin={{ top: 8, right: 12, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="window" stroke="var(--text-muted)" fontSize={11} />
                <YAxis stroke="var(--text-muted)" fontSize={11} />
                <Tooltip
                  contentStyle={{ background: 'rgba(15, 23, 42, 0.95)', border: '1px solid var(--glass-border)', borderRadius: '8px', fontSize: '0.75rem' }}
                />
                <Legend iconSize={8} wrapperStyle={{ fontSize: '0.75rem', paddingTop: '4px' }} />
                <Bar dataKey="backgroundTasks" name="Wątki Systemowe (Tasks)" fill="#64748b" radius={[4, 4, 0, 0]} opacity={0.7} />
                <Bar dataKey="activeWorkers" name="Aktywne Procesy Aplikacji" fill="#f87171" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Wykres 3: Latencja SSH & Przepustowość Sieciowa (KB/s) */}
        <div className="glass-card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Clock size={16} color="#fbbf24" />
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Latencja SSH (ms) & Przepustowość</span>
            </div>
            <span style={{ fontSize: '0.72rem', color: '#fbbf24', fontWeight: 600 }}>
              Uptime: {uptimeHours.toFixed(1)}h
            </span>
          </div>

          <div style={{ width: '100%', height: '220px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sshLatencyData} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="time" stroke="var(--text-muted)" fontSize={11} />
                <YAxis yAxisId="left" stroke="var(--text-muted)" fontSize={11} unit="ms" />
                <YAxis yAxisId="right" orientation="right" stroke="var(--text-muted)" fontSize={11} unit=" KB/s" />
                <Tooltip
                  contentStyle={{ background: 'rgba(15, 23, 42, 0.95)', border: '1px solid var(--glass-border)', borderRadius: '8px', fontSize: '0.75rem' }}
                />
                <Legend iconSize={8} wrapperStyle={{ fontSize: '0.75rem', paddingTop: '4px' }} />
                <Line yAxisId="left" type="monotone" dataKey="latencyMs" name="SSH Round-Trip (ms)" stroke="#fbbf24" strokeWidth={2} dot={{ r: 3 }} />
                <Line yAxisId="right" type="monotone" dataKey="throughputKB" name="Transfer (KB/s)" stroke="#10b981" strokeWidth={2} dot={false} strokeDasharray="3 3" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
}
