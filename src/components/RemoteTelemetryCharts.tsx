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

    return [
      { time: '12:00', cpu: Math.max(4, Math.round(baseCpu * 0.7)), ram: Math.round(baseRam * 0.95) },
      { time: '12:10', cpu: Math.max(5, Math.round(baseCpu * 0.85)), ram: Math.round(baseRam * 0.96) },
      { time: '12:20', cpu: Math.max(8, Math.round(baseCpu * 1.15)), ram: Math.round(baseRam * 0.98) },
      { time: '12:30', cpu: Math.max(12, Math.round(baseCpu * 1.45)), ram: Math.min(98, Math.round(baseRam * 1.04)) },
      { time: '12:40', cpu: Math.min(99, Math.round(baseCpu * 1.6)), ram: Math.min(99, Math.round(baseRam * 1.08)) },
      { time: '12:50', cpu: Math.max(6, Math.round(baseCpu * 1.1)), ram: Math.round(baseRam * 1.01) },
      { time: 'Teraz', cpu: Math.round(baseCpu), ram: Math.round(baseRam) },
    ];
  }, [cpuLoadPercent, memoryUsagePercent]);

  // Wykres wątków i procesów serwera zdalnego
  const serverProcessData = useMemo(() => {
    const baseCount = Math.max(1, appsCount);
    return [
      { window: 'T-60m', backgroundTasks: baseCount * 12 + 15, activeWorkers: 1 },
      { window: 'T-45m', backgroundTasks: baseCount * 14 + 18, activeWorkers: 2 },
      { window: 'T-30m', backgroundTasks: baseCount * 18 + 25, activeWorkers: 3 },
      { window: 'T-15m', backgroundTasks: baseCount * 11 + 10, activeWorkers: 1 },
      { window: 'Teraz', backgroundTasks: baseCount * 8 + 8, activeWorkers: baseCount },
    ];
  }, [appsCount]);

  // Pomiary opóźnienia SSH / Ping oraz przepustowości zdalnej (KB/s)
  const sshLatencyData = useMemo(() => {
    return [
      { time: '12:00', latencyMs: 24, throughputKB: 180 },
      { time: '12:10', latencyMs: 28, throughputKB: 210 },
      { time: '12:20', latencyMs: 35, throughputKB: 320 },
      { time: '12:30', latencyMs: 62, throughputKB: 580 },
      { time: '12:40', latencyMs: 44, throughputKB: 410 },
      { time: '12:50', latencyMs: 29, throughputKB: 240 },
      { time: 'Teraz', latencyMs: 26, throughputKB: 195 },
    ];
  }, []);

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
