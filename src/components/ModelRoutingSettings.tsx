import React, { useState, useEffect } from 'react';
import { Zap, Save, CheckCircle2, RotateCcw, ShieldCheck, ShieldAlert, Cpu, Cloud } from 'lucide-react';
import { apiClient } from '../shared/api-client';
import { useToast } from '../hooks/useToast';
import { Badge } from './Badge';
import { FormField } from './FormField';

interface ModelRoutingConfig {
  localUrl: string;
  localServerName: string;
  primaryLocalModel: string;
  fallbackLocalModel: string;
  cloudModel: string;
  circuitBreakerState?: string;
  failureCount?: number;
}

export function ModelRoutingSettings() {
  const toast = useToast();
  const [config, setConfig] = useState<ModelRoutingConfig>({
    localUrl: 'http://10.10.10.30:8888/v1',
    localServerName: 'Unsloth',
    primaryLocalModel: 'unsloth/Qwen3.5-4B-MTP-GGUF',
    fallbackLocalModel: 'granite-4.0-micro',
    cloudModel: 'AGY (Gemini Pro)',
    circuitBreakerState: 'CLOSED',
    failureCount: 0,
  });
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    async function loadConfig() {
      try {
        setLoading(true);
        const stats = await apiClient.get<any>('/api/llm/routing-stats');
        if (stats) {
          setConfig(prev => ({
            ...prev,
            localUrl: stats.localUrl || prev.localUrl,
            localServerName: stats.localServerName || prev.localServerName,
            primaryLocalModel: stats.primaryLocalModel || prev.primaryLocalModel,
            fallbackLocalModel: stats.fallbackLocalModel || prev.fallbackLocalModel,
            cloudModel: stats.cloudModel || prev.cloudModel,
            circuitBreakerState: stats.circuitBreakerState || 'CLOSED',
            failureCount: stats.failureCount || 0,
          }));
        }
      } catch {
        // Fallback do wartości początkowych
      } finally {
        setLoading(false);
      }
    }
    loadConfig();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await apiClient.post('/api/settings', {
        llmUrl: config.localUrl,
        llmName: config.localServerName,
        llmModel: config.primaryLocalModel,
      });
      setSaved(true);
      toast.success('Ustawienia routingu modeli zostały pomyślnie zapisane.');
      setTimeout(() => setSaved(false), 3000);
    } catch {
      toast.error('Błąd zapisu ustawień routingu modeli.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetBreaker = async () => {
    try {
      setResetting(true);
      await apiClient.post('/api/llm/reset-stats', {});
      setConfig(prev => ({
        ...prev,
        circuitBreakerState: 'CLOSED',
        failureCount: 0
      }));
      toast.success('Zresetowano obwód Circuit Breaker i telemetrię!');
    } catch {
      toast.error('Błąd resetowania obwodu Circuit Breaker.');
    } finally {
      setResetting(false);
    }
  };

  const isClosed = config.circuitBreakerState === 'CLOSED';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--glass-border, rgba(255,255,255,0.1))', paddingBottom: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Zap size={16} color="var(--primary, #38bdf8)" />
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
            Routing Modeli LLM
          </span>
        </div>
        <Badge
          variant={isClosed ? 'success' : 'warning'}
          size="sm"
          icon={isClosed ? <ShieldCheck size={12} /> : <ShieldAlert size={12} />}
        >
          Obwód: {config.circuitBreakerState}
        </Badge>
      </div>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <FormField
          label="Adres lokalnego serwera (Unsloth / LM Studio URL)"
          htmlFor="model-local-url"
          required
        >
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Cpu size={14} style={{ position: 'absolute', left: '0.6rem', color: '#10b981', pointerEvents: 'none' }} />
            <input
              id="model-local-url"
              type="text"
              required
              value={config.localUrl}
              onChange={e => setConfig({ ...config, localUrl: e.target.value })}
              placeholder="http://10.10.10.30:8888/v1"
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--glass-border, rgba(255,255,255,0.1))',
                borderRadius: '6px',
                padding: '0.4rem 0.6rem 0.4rem 2rem',
                color: 'var(--text-main)',
                fontSize: '0.78rem',
                outline: 'none'
              }}
            />
          </div>
        </FormField>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          <FormField
            label="Model lokalny (Low/Med Tier)"
            htmlFor="model-primary-local"
            required
          >
            <input
              id="model-primary-local"
              type="text"
              required
              value={config.primaryLocalModel}
              onChange={e => setConfig({ ...config, primaryLocalModel: e.target.value })}
              placeholder="unsloth/Qwen3.5-4B-MTP-GGUF"
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--glass-border, rgba(255,255,255,0.1))',
                borderRadius: '6px',
                padding: '0.4rem 0.6rem',
                color: 'var(--text-main)',
                fontSize: '0.78rem',
                outline: 'none'
              }}
            />
          </FormField>

          <FormField
            label="Model Fallback (Rezerwowy)"
            htmlFor="model-fallback-local"
            required
          >
            <input
              id="model-fallback-local"
              type="text"
              required
              value={config.fallbackLocalModel}
              onChange={e => setConfig({ ...config, fallbackLocalModel: e.target.value })}
              placeholder="granite-4.0-micro"
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--glass-border, rgba(255,255,255,0.1))',
                borderRadius: '6px',
                padding: '0.4rem 0.6rem',
                color: 'var(--text-main)',
                fontSize: '0.78rem',
                outline: 'none'
              }}
            />
          </FormField>
        </div>

        <FormField
          label="Model Cloud (High Tier / Architektura)"
          htmlFor="model-cloud"
          required
        >
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Cloud size={14} style={{ position: 'absolute', left: '0.6rem', color: '#818cf8', pointerEvents: 'none' }} />
            <input
              id="model-cloud"
              type="text"
              required
              value={config.cloudModel}
              onChange={e => setConfig({ ...config, cloudModel: e.target.value })}
              placeholder="AGY (Gemini Pro)"
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--glass-border, rgba(255,255,255,0.1))',
                borderRadius: '6px',
                padding: '0.4rem 0.6rem 0.4rem 2rem',
                color: 'var(--text-main)',
                fontSize: '0.78rem',
                outline: 'none'
              }}
            />
          </div>
        </FormField>

        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.3rem' }}>
          <button
            type="button"
            onClick={handleResetBreaker}
            disabled={resetting}
            className="btn-secondary"
            style={{ flex: 1, padding: '0.45rem', fontSize: '0.72rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}
            title="Resetuj Circuit Breaker do stanu CLOSED"
          >
            <RotateCcw size={12} className={resetting ? 'animate-spin' : ''} />
            <span>Resetuj obwód</span>
          </button>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
            style={{ flex: 1, padding: '0.45rem', fontSize: '0.72rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}
          >
            {saved ? <CheckCircle2 size={13} /> : <Save size={13} />}
            <span>{saved ? 'Zapisano!' : 'Zapisz routing'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
