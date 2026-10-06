
interface TokenEntry {
  model: string;
  tokens: number;
}

interface TokenBurnBreakdownProps {
  data: TokenEntry[];
}

const BAR_COLORS = [
  '#38bdf8',
  '#10b981',
  '#f59e0b',
  '#ec4899',
  '#8b5cf6',
];

export function TokenBurnBreakdown({ data }: TokenBurnBreakdownProps) {
  const total = data.reduce((s, d) => s + d.tokens, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', width: '100%' }}>
      {data.map((entry, index) => {
        const pct = total > 0 ? Math.round((entry.tokens / total) * 100) : 0;
        const color = BAR_COLORS[index % BAR_COLORS.length];
        return (
          <div key={index} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500, maxWidth: '65%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {entry.model}
              </span>
              <span style={{ fontSize: '0.75rem', color, fontWeight: 700 }}>
                {pct}% · {entry.tokens.toLocaleString()}
              </span>
            </div>
            <div style={{ height: '6px', background: 'rgba(255,255,255,0.07)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${pct}%`,
                background: color,
                borderRadius: '4px',
                boxShadow: `0 0 6px ${color}66`,
                transition: 'width 0.5s ease-out'
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
