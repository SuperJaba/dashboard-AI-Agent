import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

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
  up: 'var(--success, #10b981)',
  down: 'var(--danger, #ef4444)',
  flat: 'var(--text-muted)',
};

export function MetricSummaryCard({ title, value, subtitle, trend, icon: Icon }: MetricSummaryCardProps) {
  const TrendIcon = trend ? TREND_ICONS[trend] : null;
  const trendColor = trend ? TREND_COLORS[trend] : undefined;

  return (
    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {title}
        </span>
        {Icon && <Icon size={18} color="var(--primary)" aria-hidden="true" />}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem' }}>
        <span style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-main)', lineHeight: 1 }}>
          {value}
        </span>
        {TrendIcon && (
          <span style={{ color: trendColor, marginBottom: '0.2rem' }}>
            <TrendIcon size={16} aria-hidden="true" />
          </span>
        )}
      </div>
      {subtitle && (
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{subtitle}</span>
      )}
    </div>
  );
}
