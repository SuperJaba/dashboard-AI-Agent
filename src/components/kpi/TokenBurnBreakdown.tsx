import React from 'react';

export interface TokenEntry {
  model: string;
  tier?: string;
  tokens: number;
  percentage?: number;
}

interface TokenBurnBreakdownProps {
  data: TokenEntry[];
  totalToday?: number;
}

const TIER_COLORS: Record<string, string> = {
  'Lokalny': '#10b981',
  'Local': '#10b981',
  'Cloud': '#818cf8',
  'Fallback': '#f59e0b',
};

const PALETTE = ['#10b981', '#818cf8', '#f59e0b', '#38bdf8', '#ec4899'];

export function TokenBurnBreakdown({ data, totalToday }: TokenBurnBreakdownProps) {
  if (!data || data.length === 0) {
    return (
      <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', padding: '1rem 0' }}>
        Brak danych o zużyciu tokenów
      </div>
    );
  }

  const sumTokens = totalToday || data.reduce((acc, d) => acc + (d.tokens || 0), 0) || 1;

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {/* 1. Multi-segment stacked distribution bar */}
      <div style={{ width: '100%' }}>
        <div
          style={{
            width: '100%',
            height: '10px',
            borderRadius: '9999px',
            backgroundColor: 'rgba(255, 255, 255, 0.07)',
            overflow: 'hidden',
            display: 'flex',
            boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.4)',
          }}
        >
          {data.map((entry, index) => {
            const pct = entry.percentage ?? Math.round((entry.tokens / sumTokens) * 100);
            if (pct <= 0) return null;
            const color = entry.tier && TIER_COLORS[entry.tier] ? TIER_COLORS[entry.tier] : PALETTE[index % PALETTE.length];
            return (
              <div
                key={index}
                style={{
                  width: `${pct}%`,
                  height: '100%',
                  backgroundColor: color,
                  transition: 'width 0.4s ease',
                }}
                title={`${entry.model} (${entry.tier || ''}): ${entry.tokens.toLocaleString()} tokenów (${pct}%)`}
              />
            );
          })}
        </div>
      </div>

      {/* 2. Detailed model rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {data.map((entry, index) => {
          const pct = entry.percentage ?? Math.round((entry.tokens / sumTokens) * 100);
          const color = entry.tier && TIER_COLORS[entry.tier] ? TIER_COLORS[entry.tier] : PALETTE[index % PALETTE.length];
          return (
            <div
              key={index}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem',
                padding: '0.35rem 0.5rem',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.04)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', minWidth: 0 }}>
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: color,
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontSize: '0.78rem',
                      fontFamily: 'monospace',
                      fontWeight: 600,
                      color: 'var(--text-main)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {entry.model}
                  </span>
                  {entry.tier && (
                    <span
                      style={{
                        fontSize: '0.65rem',
                        padding: '0.1rem 0.35rem',
                        borderRadius: '4px',
                        background: `${color}18`,
                        color: color,
                        border: `1px solid ${color}35`,
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.03em',
                      }}
                    >
                      {entry.tier}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-main)' }}>
                    {entry.tokens.toLocaleString()} <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 400 }}>tok.</span>
                  </span>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      color: color,
                      minWidth: '32px',
                      textAlign: 'right',
                    }}
                  >
                    {pct}%
                  </span>
                </div>
              </div>

              {/* Mini progress bar */}
              <div
                style={{
                  width: '100%',
                  height: '4px',
                  borderRadius: '2px',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${Math.min(100, pct)}%`,
                    height: '100%',
                    backgroundColor: color,
                    borderRadius: '2px',
                    transition: 'width 0.4s ease',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
