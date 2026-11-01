import React from 'react';
import { Zap, AlertTriangle, Coins } from 'lucide-react';

export interface TaskSpeedometerProps {
  tokensPerSec?: number;
  totalTokens?: number;
  elapsedSec?: number;
  model?: string;
  estimatedCostUsd?: number;
  maxContextTokens?: number;
  className?: string;
}

export function isLocalModelName(modelName?: string): boolean {
  if (!modelName) return false;
  const lower = modelName.toLowerCase();
  return (
    lower.includes('unsloth') ||
    lower.includes('qwen') ||
    lower.includes('ollama') ||
    lower.includes('lm-studio') ||
    lower.includes('local') ||
    lower.includes('granite') ||
    lower.includes('gpt-oss')
  );
}

export function formatTokenCount(tokens?: number): string {
  if (!tokens || tokens <= 0) return '0 tok';
  if (tokens >= 1000) {
    const k = (tokens / 1000).toFixed(1).replace(/\.0$/, '');
    return `${k}k tok`;
  }
  return `${tokens} tok`;
}

export function TaskSpeedometer({
  tokensPerSec = 0,
  totalTokens = 0,
  elapsedSec = 0,
  model = '',
  estimatedCostUsd,
  maxContextTokens = 128000,
  className = '',
}: TaskSpeedometerProps) {
  const isLocal = isLocalModelName(model);

  // Cost calculation
  let costLabel = '0 zł (Lokalny)';
  if (!isLocal) {
    if (typeof estimatedCostUsd === 'number') {
      costLabel = `$${estimatedCostUsd.toFixed(4)}`;
    } else if (totalTokens > 0) {
      // Fallback estimate (~$3 / 1M tokens)
      const calculated = (totalTokens * 3) / 1000000;
      costLabel = `$${calculated.toFixed(4)}`;
    } else {
      costLabel = '$0.0000';
    }
  }

  // Context gauge calculation
  const contextRatio = maxContextTokens > 0 ? totalTokens / maxContextTokens : 0;
  const isHighContext = contextRatio >= 0.8;
  const contextPercent = Math.round(contextRatio * 100);

  return (
    <div
      className={`task-speedometer ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.65rem',
        padding: '0.35rem 0.65rem',
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '6px',
        fontSize: '0.75rem',
        color: '#e2e8f0',
        fontFamily: 'var(--mono, ui-monospace, monospace)',
      }}
    >
      {/* Speedometer indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#38bdf8' }}>
        <Zap size={13} className="text-sky-400" aria-hidden="true" />
        <span style={{ fontWeight: 600 }}>{tokensPerSec.toFixed(1)} t/s</span>
      </div>

      <span style={{ color: 'rgba(255, 255, 255, 0.2)' }}>•</span>

      {/* Total tokens */}
      <span style={{ color: '#94a3b8' }}>{formatTokenCount(totalTokens)}</span>

      <span style={{ color: 'rgba(255, 255, 255, 0.2)' }}>•</span>

      {/* Cost ticker */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: isLocal ? '#34d399' : '#fbbf24' }}>
        <Coins size={12} aria-hidden="true" />
        <span>{costLabel}</span>
      </div>

      {/* Context window gauge alert if > 80% */}
      {isHighContext && (
        <>
          <span style={{ color: 'rgba(255, 255, 255, 0.2)' }}>•</span>
          <div
            title="Wysokie zużycie kontekstu (>80% okna modelu)"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              color: '#f87171',
              background: 'rgba(239, 68, 68, 0.15)',
              padding: '0.1rem 0.35rem',
              borderRadius: '4px',
              fontWeight: 600,
            }}
          >
            <AlertTriangle size={11} color="#ef4444" aria-hidden="true" />
            <span>{contextPercent}% okna</span>
          </div>
        </>
      )}
    </div>
  );
}
