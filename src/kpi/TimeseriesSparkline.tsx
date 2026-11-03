import { useId } from 'react';
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';

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

  return (
    <div className="tabular-nums" style={{ width: '100%', fontVariantNumeric: 'tabular-nums' }}>
      {label && (
        <span style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '0.35rem', fontWeight: 600 }}>
          {label}
        </span>
      )}
      <ResponsiveContainer width="100%" height={64}>
        <LineChart data={data} margin={{ top: 6, right: 6, bottom: 6, left: 6 }}>
          <defs>
            <filter id={`neon-glow-${filterId}`} x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor={color} floodOpacity="0.65" />
            </filter>
          </defs>
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
