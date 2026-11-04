import { useId } from 'react';
import { LineChart, Line, ResponsiveContainer, Tooltip, YAxis } from 'recharts';

interface DataPoint {
  time: string;
  value: number;
}

interface TimeseriesSparklineProps {
  data: DataPoint[];
  color?: string;
  label?: string;
}

export function TimeseriesSparkline({ data, color = 'var(--primary, #4F46E5)', label }: TimeseriesSparklineProps) {
  const filterId = useId().replace(/:/g, '');
  const hasValues = Array.isArray(data) && data.length > 0;
  const hasNonZero = hasValues && data.some(d => (d.value || 0) > 0);

  // Gdy wszystkie wartości są 0, wyrenderuj czysty kontener pustego stanu
  if (!hasNonZero) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '64px',
        color: 'var(--text-muted)',
        fontSize: '0.75rem',
        textAlign: 'center',
        background: 'rgba(255, 255, 255, 0.02)',
        borderRadius: '8px',
        border: '1px dashed var(--glass-border, rgba(255, 255, 255, 0.1))'
      }}>
        {label && <span style={{ marginRight: '0.5rem' }}>{label}</span>}
        Brak wywołań w bieżącym oknie (0 tokenów)
      </div>
    );
  }

  return (
    <div className="tabular-nums" style={{ width: '100%', minHeight: '64px', fontVariantNumeric: 'tabular-nums', position: 'relative' }}>
      {label && (
        <span style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '0.35rem', fontWeight: 600 }}>
          {label}
        </span>
      )}
      <ResponsiveContainer width="100%" height={64} minWidth={100} minHeight={64}>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <defs>
            <filter id={`neon-glow-${filterId}`} x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor={color} floodOpacity="0.65" />
            </filter>
          </defs>
          <YAxis hide domain={[0, (dataMax: number) => (dataMax > 0 ? Math.ceil(dataMax * 1.2) : 100)]} />
          <Tooltip
            contentStyle={{
              background: 'rgba(15, 23, 42, 0.85)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '10px',
              boxShadow: '0 8px 24px -4px rgba(0, 0, 0, 0.5), 0 0 16px -2px rgba(99, 102, 241, 0.25)',
              color: '#ffffff',
              fontSize: '0.75rem',
              padding: '0.4rem 0.75rem'
            }}
            itemStyle={{ color: '#c7d2fe', fontWeight: 600 }}
            labelStyle={{ display: 'none' }}
            formatter={(val: unknown) => [`${Number(val || 0).toLocaleString()} tokenów`, 'Zużycie']}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2.5}
            dot={false}
            filter={`url(#neon-glow-${filterId})`}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
