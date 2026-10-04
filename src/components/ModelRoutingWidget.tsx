import React, { useState } from 'react';
import { Cpu, Cloud, Zap, ArrowRight, ShieldCheck } from 'lucide-react';

interface ModelRoutingStats {
  localTasks: number;
  cloudTasks: number;
  circuitBreakerState: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  primaryLocalModel: string;
  fallbackLocalModel: string;
  cloudModel: string;
  avgLocalLatencyMs: number;
  avgCloudLatencyMs: number;
}

export function ModelRoutingWidget() {
  const [stats] = useState<ModelRoutingStats>({
    localTasks: 84,
    cloudTasks: 16,
    circuitBreakerState: 'CLOSED',
    primaryLocalModel: 'openai/gpt-oss-20b',
    fallbackLocalModel: 'granite-4.0-micro',
    cloudModel: 'AGY (Gemini Pro)',
    avgLocalLatencyMs: 380,
    avgCloudLatencyMs: 1450,
  });

  const total = stats.localTasks + stats.cloudTasks;
  const localRatio = total > 0 ? Math.round((stats.localTasks / total) * 100) : 0;

  return (
    <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Zap size={18} color="var(--primary, #38bdf8)" />
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
            Inteligentny Routing Modeli (T5)
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: stats.circuitBreakerState === 'CLOSED' ? '#10b981' : '#f59e0b' }}>
          <ShieldCheck size={14} />
          <span>Circuit: {stats.circuitBreakerState}</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
        {/* Local Tier */}
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Tier Low / Medium (Local)</span>
            <Cpu size={14} color="#10b981" />
          </div>
          <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#10b981' }}>
            {localRatio}% <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-muted)' }}>({stats.localTasks} zadań)</span>
          </span>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            Model: <code style={{ color: 'var(--primary)' }}>{stats.primaryLocalModel}</code>
          </span>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            Fallback: <code>{stats.fallbackLocalModel}</code>
          </span>
          <span style={{ fontSize: '0.7rem', color: '#10b981' }}>
            Śr. czas: ~{stats.avgLocalLatencyMs}ms (0 zł)
          </span>
        </div>

        {/* Cloud Tier */}
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Tier High (Cloud / AGY)</span>
            <Cloud size={14} color="#818cf8" />
          </div>
          <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#818cf8' }}>
            {100 - localRatio}% <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-muted)' }}>({stats.cloudTasks} zadań)</span>
          </span>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            Model: <code style={{ color: '#818cf8' }}>{stats.cloudModel}</code>
          </span>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            Złożone: Refactoring, Architektura
          </span>
          <span style={{ fontSize: '0.7rem', color: '#818cf8' }}>
            Śr. czas: ~{stats.avgCloudLatencyMs}ms
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', paddingTop: '0.25rem' }}>
        <span>Przepływ:</span>
        <code>Zapytanie</code>
        <ArrowRight size={12} />
        <code>Scorer (low/med/high)</code>
        <ArrowRight size={12} />
        <code>10.10.10.30:1234 (LM Studio) / AGY</code>
      </div>
    </div>
  );
}
