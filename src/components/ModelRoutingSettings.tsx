import React, { useState, useEffect } from 'react';
import { Zap, Save, CheckCircle2, RotateCcw, ShieldCheck, ShieldAlert, Cpu, Cloud } from 'lucide-react';
import { apiClient } from '../shared/api-client';

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
  const [message, setMessage] = useState<string | null>(null);

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
      setMessage('Ustawienia routingu modeli zapisane!');
      setTimeout(() => {
        setSaved(false);
        setMessage(null);
      }, 3000);
    } catch {
      setMessage('Błąd zapisu ustawień');
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
      setMessage('Zresetowano obwód Circuit Breaker i telemetrię!');
      setTimeout(() => setMessage(null), 3000);
    } catch {
      setMessage('Błąd resetowania obwodu');
    } finally {
      setResetting(false);
    }
  };

  const isClosed = config.circuitBreakerState === 'CLOSED';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Zap size={16} color="var(--primary, #38bdf8)" />
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
            Routing Modeli LLM
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', color: isClosed ? '#10b981' : '#f59e0b', fontWeight: 600 }}>
          {isClosed ? <ShieldCheck size={13} /> : <ShieldAlert size={13} />}
          <span>Obwód: {config.circuitBreakerState}</span>
        </div>
      </div>

      {message && (
        <div style={{ fontSize: '0.75rem', padding: '0.4rem 0.6rem', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
          {message}
        </div>
      )}

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        <div>
          <label className="info-label" style={{ fontSize: '0.72rem', marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <Cpu size={12} color="#10b981" />
            <span>Adres lokalnego serwera (Unsloth / LM Studio URL)</span>
          </label>
          <input
            type="text"
            required
            value={config.localUrl}
            onChange={e => setConfig({ ...config, localUrl: e.target.value })}
            placeholder="http://10.10.10.30:8888/v1"
            style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: '6px', padding: '0.4rem 0.6rem', color: 'white', fontSize: '0.78rem', outline: 'none' }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          <div>
            <label className="info-label" style={{ fontSize: '0.72rem', marginBottom: '0.2rem', display: 'block' }}>
              Model lokalny (Low/Med Tier)
            </label>
            <input
              type="text"
              required
              value={config.primaryLocalModel}
              onChange={e => setConfig({ ...config, primaryLocalModel: e.target.value })}
              placeholder="unsloth/Qwen3.5-4B-MTP-GGUF"
              style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: '6px', padding: '0.4rem 0.6rem', color: 'white', fontSize: '0.78rem', outline: 'none' }}
            />
          </div>

          <div>
            <label className="info-label" style={{ fontSize: '0.72rem', marginBottom: '0.2rem', display: 'block' }}>
              Model Fallback (Rezerwowy)
            </label>
            <input
              type="text"
              required
              value={config.fallbackLocalModel}
              onChange={e => setConfig({ ...config, fallbackLocalModel: e.target.value })}
              placeholder="granite-4.0-micro"
              style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: '6px', padding: '0.4rem 0.6rem', color: 'white', fontSize: '0.78rem', outline: 'none' }}
            />
          </div>
        </div>

        <div>
          <label className="info-label" style={{ fontSize: '0.72rem', marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <Cloud size={12} color="#818cf8" />
            <span>Model Cloud (High Tier / Architektura)</span>
          </label>
          <input
            type="text"
            required
            value={config.cloudModel}
            onChange={e => setConfig({ ...config, cloudModel: e.target.value })}
            placeholder="AGY (Gemini Pro)"
            style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: '6px', padding: '0.4rem 0.6rem', color: 'white', fontSize: '0.78rem', outline: 'none' }}
          />
        </div>

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
