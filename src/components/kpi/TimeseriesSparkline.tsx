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

export function TimeseriesSparkline({ data, color = 'var(--primary)', label }: TimeseriesSparklineProps) {
  return (
    <div style={{ width: '100%' }}>
      {label && (
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
          {label}
        </span>
      )}
      <ResponsiveContainer width="100%" height={60}>
        <LineChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
          <Tooltip
            contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--glass-border)', borderRadius: '6px', fontSize: '0.75rem' }}
            labelStyle={{ display: 'none' }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
