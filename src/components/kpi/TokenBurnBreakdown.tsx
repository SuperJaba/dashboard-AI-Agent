import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface TokenEntry {
  model: string;
  tokens: number;
}

interface TokenBurnBreakdownProps {
  data: TokenEntry[];
}

const BAR_COLORS = [
  'var(--primary, #38bdf8)',
  '#10b981',
  '#f59e0b',
  '#ec4899',
  '#8b5cf6',
];

export function TokenBurnBreakdown({ data }: TokenBurnBreakdownProps) {
  return (
    <div className="tabular-nums" style={{ width: '100%', fontVariantNumeric: 'tabular-nums' }}>
      <ResponsiveContainer width="100%" height={Math.max(60, data.length * 36)}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 8, bottom: 4, left: 4 }}
        >
          <XAxis type="number" hide />
          <XAxis dataKey="model" type="category" hide />
          <Tooltip
            contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--glass-border)', borderRadius: '6px', fontSize: '0.75rem' }}
            formatter={(val: number) => [val.toLocaleString(), 'tokens']}
          />
          <Bar dataKey="tokens" radius={[0, 4, 4, 0]}>
            {data.map((_entry, index) => (
              <Cell key={index} fill={BAR_COLORS[index % BAR_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
