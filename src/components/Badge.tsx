import type { ReactNode } from 'react';

export type BadgeVariant = 'primary' | 'success' | 'warning' | 'danger' | 'neutral' | 'info';
export type BadgeSize = 'sm' | 'md';

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  primary: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
  success: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  warning: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  danger: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  neutral: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
  info: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
};

const SIZE_CLASSES: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-[11px]',
  md: 'px-2.5 py-1 text-xs',
};

export interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Badge({
  variant = 'primary',
  size = 'md',
  icon,
  children,
  className = '',
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium border ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
    >
      {icon && <span className="flex-none flex items-center" aria-hidden="true">{icon}</span>}
      <span>{children}</span>
    </span>
  );
}
