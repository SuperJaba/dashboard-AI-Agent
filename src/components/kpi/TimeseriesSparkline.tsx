import React from 'react';
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

export function TimeseriesSparkline({ data, color = 'var(--primary, #38bdf8)', label }: TimeseriesSparklineProps) {
  const values = data.map(d => d.value);
  const minVal = values.length ? Math.min(...values) : 0;
  const maxVal = values.length ? Math.max(...values) : 0;
  const latest = values.length ? values[values.length - 1] : 0;

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {label && (
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>
          {label}
        </span>
      )}
      <div style={{ width: '100%', height: 70 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <YAxis hide domain={[Math.max(0, minVal - 1), maxVal + 1]} />
            <Tooltip
              contentStyle={{
                background: 'rgba(15, 23, 42, 0.95)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                fontSize: '0.8rem',
                color: '#fff',
                boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
              }}
              formatter={(val: number) => [`${val} zadań`, 'Zadania']}
              labelFormatter={(label) => `Okno #${label}`}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={3}
              dot={{ r: 3, fill: color, strokeWidth: 1 }}
              activeDot={{ r: 5, fill: '#fff', stroke: color, strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', paddingTop: '0.35rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <span>Min: <strong style={{ color: 'var(--text-main)' }}>{minVal}</strong></span>
        <span>Bieżące: <strong style={{ color: color }}>{latest}</strong></span>
        <span>Max: <strong style={{ color: 'var(--text-main)' }}>{maxVal}</strong></span>
      </div>
    </div>
  );
}
