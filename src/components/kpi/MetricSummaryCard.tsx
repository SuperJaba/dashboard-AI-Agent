import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { AntigravityCard } from '../AntigravityCard';

interface MetricSummaryCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'flat';
  icon?: LucideIcon;
}

const TREND_ICONS = {
  up: TrendingUp,
  down: TrendingDown,
  flat: Minus,
};

const TREND_COLORS = {
  up: '#10b981',
  down: '#ef4444',
  flat: '#94a3b8',
};

export function MetricSummaryCard({ title, value, subtitle, trend, icon: Icon }: MetricSummaryCardProps) {
  const TrendIcon = trend ? TREND_ICONS[trend] : null;
  const trendColor = trend ? TREND_COLORS[trend] : undefined;
  const glowColor = trend === 'up' 
    ? 'rgba(16, 185, 129, 0.18)' 
    : trend === 'down' 
      ? 'rgba(239, 68, 68, 0.18)' 
      : 'rgba(79, 70, 229, 0.15)';

  return (
    <AntigravityCard 
      elevation="medium"
      maxTilt={6}
      glowColor={glowColor}
      style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', padding: '1.25rem' }}
    >
      <div className="antigravity-depth-pop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {title}
        </span>
        {Icon && (
          <div style={{
            padding: '0.35rem',
            borderRadius: '8px',
            background: 'rgba(79, 70, 229, 0.12)',
            border: '1px solid rgba(79, 70, 229, 0.25)',
            color: '#818cf8'
          }}>
            <Icon size={18} aria-hidden="true" />
          </div>
        )}
      </div>
      <div className="antigravity-depth-pop" style={{ display: 'flex', alignItems: 'flex-end', gap: '0.6rem' }}>
        <span className="tabular-nums" style={{ fontSize: '1.9rem', fontWeight: 800, color: '#ffffff', lineHeight: 1, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
          {value}
        </span>
        {TrendIcon && (
          <span style={{ 
            color: trendColor, 
            marginBottom: '0.2rem',
            display: 'flex',
            alignItems: 'center',
            background: trend === 'up' ? 'rgba(16, 185, 129, 0.12)' : trend === 'down' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(255,255,255,0.05)',
            padding: '0.15rem 0.4rem',
            borderRadius: '9999px',
            border: `1px solid ${trendColor}33`
          }}>
            <TrendIcon size={14} aria-hidden="true" />
          </span>
        )}
      </div>
      {subtitle && (
        <span className="antigravity-depth-sub" style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 500 }}>{subtitle}</span>
      )}
    </AntigravityCard>
  );
}
