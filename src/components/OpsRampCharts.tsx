import { useState } from 'react';
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

interface OpsRampChartsProps {
  rawEventsCount?: number;
  correlatedIncidentsCount?: number;
  noiseReductionRate?: number;
}

export function OpsRampCharts({
  rawEventsCount = 2480,
  correlatedIncidentsCount = 4,
  noiseReductionRate = 98.4
}: OpsRampChartsProps) {
  const [timeRange, setTimeRange] = useState<'15m' | '1h' | '6h'>('1h');

  // Dane telemetryczne hosta i kontenerów (CPU & RAM)
  const hostTelemetryData = [
    { time: '12:00', cpu: 14, ram: 62, diskIO: 12 },
    { time: '12:10', cpu: 18, ram: 63, diskIO: 15 },
    { time: '12:20', cpu: 28, ram: 65, diskIO: 32 },
    { time: '12:30', cpu: 45, ram: 69, diskIO: 58 },
    { time: '12:40', cpu: 72, ram: 74, diskIO: 85 },
    { time: '12:50', cpu: 38, ram: 70, diskIO: 42 },
    { time: '13:00', cpu: 22, ram: 68, diskIO: 20 },
  ];

  // Dane korelacji AIOps: Surowe alerty vs Przefiltrowane incydenty w oknach czasowych
  const aiopsNoiseData = [
    { window: 'T-60m', raw: Math.round(rawEventsCount * 0.18), correlated: 1 },
    { window: 'T-45m', raw: Math.round(rawEventsCount * 0.22), correlated: 1 },
    { window: 'T-30m', raw: Math.round(rawEventsCount * 0.35), correlated: 2 },
    { window: 'T-15m', raw: Math.round(rawEventsCount * 0.15), correlated: 0 },
    { window: 'Teraz', raw: Math.round(rawEventsCount * 0.10), correlated: correlatedIncidentsCount > 0 ? 1 : 0 },
  ];

  // Czasy odpowiedzi modeli i throughput agentów
  const inferenceTelemetryData = [
    { time: '12:00', latencyMs: 340, throughput: 42, tokensPerSec: 120 },
    { time: '12:10', latencyMs: 380, throughput: 55, tokensPerSec: 145 },
    { time: '12:20', latencyMs: 420, throughput: 68, tokensPerSec: 180 },
    { time: '12:30', latencyMs: 580, throughput: 95, tokensPerSec: 230 },
    { time: '12:40', latencyMs: 490, throughput: 72, tokensPerSec: 190 },
    { time: '12:50', latencyMs: 370, throughput: 50, tokensPerSec: 135 },
    { time: '13:00', latencyMs: 350, throughput: 46, tokensPerSec: 128 },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
      {/* Pasek kontrolny wykresów */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Activity size={18} color="#38bdf8" />
          <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)' }}>
            Natywna Telemetria OpsRamp & Wykresy Systemowe
          </span>
          <span style={{ fontSize: '0.72rem', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '0.15rem 0.5rem', borderRadius: '999px', fontWeight: 600 }}>
            Live Stream
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

      {/* Siatka 3 głównych wykresów */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '1rem' }}>
        
        {/* Wykres 1: Zużycie CPU & RAM w czasie */}
        <div className="glass-card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Cpu size={16} color="#38bdf8" />
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Obciążenie CPU & Pamięć RAM (%)</span>
            </div>
            <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 600 }}>
              Śr. CPU: 33% · RAM: 68%
            </span>
          </div>

          <div style={{ width: '100%', height: '220px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={hostTelemetryData} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="ramGrad" x1="0" y1="0" x2="0" y2="1">
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
                <Area type="monotone" dataKey="cpu" name="CPU Usage (%)" stroke="#38bdf8" strokeWidth={2} fillOpacity={1} fill="url(#cpuGrad)" />
                <Area type="monotone" dataKey="ram" name="RAM Allocation (%)" stroke="#818cf8" strokeWidth={2} fillOpacity={1} fill="url(#ramGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Wykres 2: Redukcja szumu AIOps (Surowe vs Skorelowane) */}
        <div className="glass-card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Zap size={16} color="#c084fc" />
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Filtracja AIOps: Surowe Zdarzenia vs Incydenty</span>
            </div>
            <span style={{ fontSize: '0.72rem', color: '#c084fc', fontWeight: 700 }}>
              Efektywność: {noiseReductionRate}%
            </span>
          </div>

          <div style={{ width: '100%', height: '220px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={aiopsNoiseData} margin={{ top: 8, right: 12, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="window" stroke="var(--text-muted)" fontSize={11} />
                <YAxis stroke="var(--text-muted)" fontSize={11} />
                <Tooltip
                  contentStyle={{ background: 'rgba(15, 23, 42, 0.95)', border: '1px solid var(--glass-border)', borderRadius: '8px', fontSize: '0.75rem' }}
                />
                <Legend iconSize={8} wrapperStyle={{ fontSize: '0.75rem', paddingTop: '4px' }} />
                <Bar dataKey="raw" name="Surowe Zdarzenia (Szum)" fill="#64748b" radius={[4, 4, 0, 0]} opacity={0.7} />
                <Bar dataKey="correlated" name="Skorelowane Incydenty AIOps" fill="#f87171" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Wykres 3: Czas odpowiedzi inferencji (LLM Latency & Throughput) */}
        <div className="glass-card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Clock size={16} color="#fbbf24" />
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Czas odpowiedzi inferencji (ms) & Throughput</span>
            </div>
            <span style={{ fontSize: '0.72rem', color: '#fbbf24', fontWeight: 600 }}>
              P95: ~580ms · Avg: ~410ms
            </span>
          </div>

          <div style={{ width: '100%', height: '220px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={inferenceTelemetryData} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="time" stroke="var(--text-muted)" fontSize={11} />
                <YAxis yAxisId="left" stroke="var(--text-muted)" fontSize={11} unit="ms" />
                <YAxis yAxisId="right" orientation="right" stroke="var(--text-muted)" fontSize={11} unit=" t/s" />
                <Tooltip
                  contentStyle={{ background: 'rgba(15, 23, 42, 0.95)', border: '1px solid var(--glass-border)', borderRadius: '8px', fontSize: '0.75rem' }}
                />
                <Legend iconSize={8} wrapperStyle={{ fontSize: '0.75rem', paddingTop: '4px' }} />
                <Line yAxisId="left" type="monotone" dataKey="latencyMs" name="Opóźnienie Inferencji (ms)" stroke="#fbbf24" strokeWidth={2} dot={{ r: 3 }} />
                <Line yAxisId="right" type="monotone" dataKey="tokensPerSec" name="Tokens / sec" stroke="#10b981" strokeWidth={2} dot={false} strokeDasharray="3 3" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
}
