import { useEffect, useState } from 'react';
import { apiClient } from './shared/api-client';
import { 
  Activity, 
  ShieldAlert, 
  CheckCircle2, 
  RefreshCw, 
  Cpu, 
  HardDrive, 
  Zap, 
  Server, 
  Info,
  PlusCircle,
  Radio,
  Sliders,
  BarChart3,
  ExternalLink,
  Settings
} from 'lucide-react';

interface OpsAlert {
  id: string;
  subject: string;
  resource: string;
  resourceType: string;
  severity: 'critical' | 'warning' | 'info';
  state: 'active' | 'acknowledged' | 'resolved';
  deduplicatedCount: number;
  aiCorrelationReason: string;
  firstSeen: string;
  lastSeen: string;
}

interface OpsResource {
  id: string;
  name: string;
  type: string;
  environment: string;
  ip: string;
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  cpuUsage: string;
  memoryUsage: string;
  lastSeen: string;
}

interface OpsStatus {
  enabled: boolean;
  mockMode: boolean;
  connection: string;
  tenant: {
    id: string;
    name: string;
    status: string;
    region: string;
    mode: string;
  };
  gateway: {
    status: string;
    version: string;
    ipAddress: string;
    lastHeartbeat: string;
    scrapedEndpoints: number;
    metricsPushedPerMin: number;
  };
  aiops: {
    rawEventsCount: number;
    correlatedIncidentsCount: number;
    noiseReductionRate: number;
    meanTimeToDetectSeconds: number;
  };
}

export function OpsRampView() {
  const [status, setStatus] = useState<OpsStatus | null>(null);
  const [alerts, setAlerts] = useState<OpsAlert[]>([]);
  const [resources, setResources] = useState<OpsResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState<'all' | 'critical' | 'warning' | 'info'>('all');
  const [isSimulating, setIsSimulating] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const [remoteServers, setRemoteServers] = useState<any[]>([]);
  const [grafanaUrl, setGrafanaUrl] = useState<string>(() => {
    return localStorage.getItem('opsramp_grafana_url') || 'http://localhost:3000';
  });
  const [showGrafanaEmbed, setShowGrafanaEmbed] = useState<boolean>(() => {
    return localStorage.getItem('opsramp_grafana_embed') === 'true';
  });
  const [showGrafanaConfig, setShowGrafanaConfig] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);

  const fetchData = async () => {
    try {
      const [statusData, alertsData, resourcesData, serversData] = await Promise.all([
        apiClient.get<OpsStatus>('/api/opsramp/status'),
        apiClient.get<{ alerts: OpsAlert[] }>('/api/opsramp/alerts'),
        apiClient.get<{ resources: OpsResource[] }>('/api/opsramp/resources'),
        apiClient.get<any[]>('/api/servers').catch(() => [])
      ]);

      setStatus(statusData);
      setAlerts(alertsData.alerts || []);
      setResources(resourcesData.resources || []);
      if (Array.isArray(serversData)) {
        setRemoteServers(serversData);
      }
    } catch (err) {
      console.error('Failed to fetch OpsRamp data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleAcknowledge = async (alertId: string) => {
    try {
      await apiClient.post(`/api/opsramp/alerts/${alertId}/ack`);
      setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, state: 'acknowledged' } : a));
      showMessage(`Alert ${alertId} został oznaczony jako Acknowledged.`);
    } catch (e) {
      console.error('Ack error:', e);
    }
  };

  const handleResolve = async (alertId: string) => {
    try {
      await apiClient.post(`/api/opsramp/alerts/${alertId}/resolve`);
      setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, state: 'resolved' } : a));
      showMessage(`Alert ${alertId} został rozwiązany (Resolved).`);
    } catch (e) {
      console.error('Resolve error:', e);
    }
  };

  const handleSimulateAlert = async () => {
    setIsSimulating(true);
    try {
      await apiClient.post('/api/opsramp/simulate-alert', {
        subject: 'Wykryto anomalię czasu odpowiedzi inferencji LLM (>520ms)',
        resource: 'llama_proxy',
        resourceType: 'AI Gateway',
        severity: 'warning',
        reason: 'Automatyczna korelacja AIOps: gwałtowny wzrost współbieżnych promptów od lokalnych agentów.'
      });
      await fetchData();
      showMessage('Zasymulowano nowe zdarzenie AIOps. OpsRamp skorelował incydent!');
    } catch (e) {
      console.error('Simulation error:', e);
    } finally {
      setIsSimulating(false);
    }
  };

  const showMessage = (msg: string) => {
    setActionMessage(msg);
    setTimeout(() => setActionMessage(null), 3500);
  };

  const filteredAlerts = alerts.filter(alert => {
    if (severityFilter === 'all') return true;
    return alert.severity === severityFilter;
  });

  const criticalCount = alerts.filter(a => a.severity === 'critical' && a.state !== 'resolved').length;
  const warningCount = alerts.filter(a => a.severity === 'warning' && a.state !== 'resolved').length;
  const activeCount = alerts.filter(a => a.state === 'active').length;

  if (loading && !status) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh', color: 'var(--text-muted)' }}>
        <RefreshCw size={24} className="animate-spin" style={{ marginRight: '0.75rem' }} />
        <span>Ładowanie danych OpsRamp Observability...</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', maxWidth: '1400px', margin: '0 auto' }}>
      
      {/* Header & Status Banner */}
      <div className="glass-card" style={{ padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ 
            width: '46px', 
            height: '46px', 
            borderRadius: '12px', 
            background: 'linear-gradient(135deg, #0284c7, #38bdf8)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 4px 14px rgba(56, 189, 248, 0.4)'
          }}>
            <Activity size={24} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>
                HPE OpsRamp Observability & AIOps
              </h2>
              <span style={{ 
                fontSize: '0.75rem', 
                padding: '0.2rem 0.6rem', 
                borderRadius: '999px', 
                background: status?.mockMode ? 'rgba(56, 189, 248, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                color: status?.mockMode ? '#38bdf8' : '#10b981',
                border: `1px solid ${status?.mockMode ? 'rgba(56, 189, 248, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                fontWeight: 600
              }}>
                {status?.mockMode ? 'Docker Mock Sandbox' : 'Live SaaS Connected'}
              </span>
            </div>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Tenant: <strong style={{ color: 'var(--text-main)' }}>{status?.tenant.name || 'Sandbox Tenant'}</strong> ({status?.tenant.id}) &bull; Region: {status?.tenant.region || 'eu-central-1'}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          {/* Grafana External Button */}
          <a
            href={grafanaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              fontSize: '0.85rem',
              padding: '0.5rem 0.85rem',
              background: 'rgba(249, 115, 22, 0.12)',
              color: '#fb923c',
              border: '1px solid rgba(249, 115, 22, 0.3)',
              textDecoration: 'none'
            }}
            title={`Otwórz Grafanę (${grafanaUrl}) w nowej karcie`}
          >
            <BarChart3 size={15} />
            <span>Otwórz Grafanę</span>
            <ExternalLink size={13} style={{ opacity: 0.8 }} />
          </a>

          {/* Grafana Live Embed Checkbox */}
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              fontSize: '0.82rem',
              color: showGrafanaEmbed ? '#fb923c' : 'var(--text-muted)',
              cursor: 'pointer',
              padding: '0.5rem 0.75rem',
              background: showGrafanaEmbed ? 'rgba(249, 115, 22, 0.1)' : 'rgba(255, 255, 255, 0.03)',
              border: `1px solid ${showGrafanaEmbed ? 'rgba(249, 115, 22, 0.35)' : 'rgba(255, 255, 255, 0.1)'}`,
              borderRadius: '8px',
              userSelect: 'none',
              transition: '0.2s'
            }}
            title="Włącz lub wyłącz osadzony widok dashboardu Grafany bezpośrednio w OpsRamp"
          >
            <input
              type="checkbox"
              checked={showGrafanaEmbed}
              onChange={(e) => {
                setShowGrafanaEmbed(e.target.checked);
                localStorage.setItem('opsramp_grafana_embed', String(e.target.checked));
              }}
              style={{ cursor: 'pointer', accentColor: '#f97316' }}
            />
            <span>Wykresy Grafana Live</span>
          </label>

          {/* Grafana Config Button */}
          <button
            type="button"
            className="btn-secondary"
            style={{
              padding: '0.5rem',
              color: showGrafanaConfig ? '#fb923c' : 'var(--text-muted)',
              background: showGrafanaConfig ? 'rgba(249, 115, 22, 0.15)' : undefined,
              borderColor: showGrafanaConfig ? '#fb923c' : undefined
            }}
            onClick={() => setShowGrafanaConfig(!showGrafanaConfig)}
            title="Skonfiguruj adres i serwer Grafany"
          >
            <Settings size={15} />
          </button>

          <button 
            type="button"
            className="btn-primary" 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem', 
              fontSize: '0.85rem', 
              padding: '0.5rem 1rem',
              background: 'linear-gradient(135deg, #0284c7, #2563eb)'
            }}
            onClick={handleSimulateAlert}
            disabled={isSimulating}
          >
            <PlusCircle size={16} />
            <span>{isSimulating ? 'Symulacja...' : 'Zasymuluj Incydent AIOps'}</span>
          </button>
          <button 
            type="button"
            className="btn-secondary" 
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', padding: '0.5rem 0.8rem' }}
            onClick={fetchData}
            title="Odśwież dane"
          >
            <RefreshCw size={15} />
            <span>Odśwież</span>
          </button>
        </div>
      </div>

      {showGrafanaConfig && (
        <div className="glass-card animate-in" style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', border: '1px solid rgba(249, 115, 22, 0.3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fb923c' }}>
              Konfiguracja połączenia z Grafaną
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Port domyślny: 3000
            </span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text"
              value={grafanaUrl}
              onChange={(e) => {
                setGrafanaUrl(e.target.value);
                localStorage.setItem('opsramp_grafana_url', e.target.value);
              }}
              placeholder="http://localhost:3000 lub http://host:3000"
              style={{
                flex: 1,
                minWidth: '240px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--glass-border)',
                borderRadius: '8px',
                padding: '0.45rem 0.75rem',
                color: 'white',
                fontSize: '0.85rem',
                fontFamily: 'var(--mono)'
              }}
            />
            {remoteServers.map((s) => (
              <button
                key={s.id}
                type="button"
                className="btn-secondary"
                style={{ fontSize: '0.75rem', padding: '0.45rem 0.75rem' }}
                onClick={() => {
                  const target = `http://${s.host}:3000`;
                  setGrafanaUrl(target);
                  localStorage.setItem('opsramp_grafana_url', target);
                  setIframeKey(k => k + 1);
                }}
              >
                Użyj serwera: {s.name || s.host}
              </button>
            ))}
            <button
              type="button"
              className="btn-secondary"
              style={{ fontSize: '0.75rem', padding: '0.45rem 0.75rem' }}
              onClick={() => {
                setGrafanaUrl('http://localhost:3000');
                localStorage.setItem('opsramp_grafana_url', 'http://localhost:3000');
                setIframeKey(k => k + 1);
              }}
            >
              Reset do localhost:3000
            </button>
          </div>
        </div>
      )}

      {actionMessage && (
        <div style={{ 
          padding: '0.75rem 1rem', 
          background: 'rgba(16, 185, 129, 0.12)', 
          border: '1px solid rgba(16, 185, 129, 0.3)', 
          borderRadius: '8px', 
          color: '#34d399', 
          fontSize: '0.875rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <CheckCircle2 size={18} />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* KPI Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
        
        {/* Noise Reduction KPI */}
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>AIOps Noise Reduction</span>
            <div style={{ padding: '0.35rem', borderRadius: '8px', background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc' }}>
              <Zap size={18} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#c084fc' }}>
              {status?.aiops.noiseReductionRate || 98.4}%
            </span>
            <span style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: 600 }}>redukcji szumu</span>
          </div>
          <p style={{ margin: '0.35rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {status?.aiops.rawEventsCount || 2480} surowych zdarzeń &rarr; <strong>{status?.aiops.correlatedIncidentsCount || 4} incydenty</strong>
          </p>
        </div>

        {/* Active Incidents */}
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>Aktywne Incydenty</span>
            <div style={{ padding: '0.35rem', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171' }}>
              <ShieldAlert size={18} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: activeCount > 0 ? '#f87171' : '#10b981' }}>
              {activeCount}
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>wymagających uwagi</span>
          </div>
          <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.4rem', fontSize: '0.75rem' }}>
            <span style={{ color: '#f87171', fontWeight: 600 }}>{criticalCount} Critical</span>
            <span style={{ color: '#fbbf24', fontWeight: 600 }}>{warningCount} Warning</span>
          </div>
        </div>

        {/* Gateway & Scraper Health */}
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>OpsRamp Gateway Status</span>
            <div style={{ padding: '0.35rem', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
              <Radio size={18} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ 
              width: '10px', 
              height: '10px', 
              borderRadius: '50%', 
              background: '#10b981', 
              boxShadow: '0 0 8px #10b981' 
            }} />
            <span style={{ fontSize: '1.2rem', fontWeight: 700, color: '#34d399' }}>
              {status?.gateway.status || 'ONLINE'}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({status?.gateway.version})</span>
          </div>
          <p style={{ margin: '0.35rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Endpoints: <strong>{status?.gateway.scrapedEndpoints || 4}</strong> &bull; {status?.gateway.metricsPushedPerMin || 1240} metryk/min
          </p>
        </div>

        {/* Discovered Resources */}
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>Monitorowane Zasoby</span>
            <div style={{ padding: '0.35rem', borderRadius: '8px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
              <Server size={18} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#38bdf8' }}>
              {resources.length}
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>obiektów w Dockerze</span>
          </div>
          <p style={{ margin: '0.35rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Postgres, Llama Proxy, Prometheus, Backend API
          </p>
        </div>

      </div>

      {/* Grafana Live Telemetry Embed */}
      {showGrafanaEmbed && (
        <div className="glass-card animate-in" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', border: '1px solid rgba(249, 115, 22, 0.35)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div style={{ padding: '0.4rem', borderRadius: '8px', background: 'rgba(249, 115, 22, 0.15)', color: '#fb923c' }}>
                <BarChart3 size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-main)' }}>
                  Grafana Live Telemetry & Metrics
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Źródło: <code style={{ color: '#fb923c' }}>{grafanaUrl}</code>
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setIframeKey(k => k + 1)}
                className="btn-secondary"
                style={{ fontSize: '0.75rem', padding: '0.3rem 0.65rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                title="Odśwież ramkę Grafany"
              >
                <RefreshCw size={13} />
                <span>Odśwież</span>
              </button>
              <a
                href={grafanaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary"
                style={{ fontSize: '0.75rem', padding: '0.3rem 0.65rem', display: 'flex', alignItems: 'center', gap: '0.3rem', textDecoration: 'none', color: '#fb923c' }}
              >
                <span>Pełny ekran</span>
                <ExternalLink size={12} />
              </a>
              <button
                type="button"
                onClick={() => {
                  setShowGrafanaEmbed(false);
                  localStorage.setItem('opsramp_grafana_embed', 'false');
                }}
                className="btn-secondary"
                style={{ fontSize: '0.75rem', padding: '0.3rem 0.65rem', color: 'var(--text-muted)' }}
              >
                Zwiń
              </button>
            </div>
          </div>

          <div style={{ position: 'relative', width: '100%', height: '540px', borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(255, 255, 255, 0.08)', background: '#0b0f19' }}>
            <iframe
              key={iframeKey}
              src={grafanaUrl}
              title="Grafana Dashboard"
              style={{ width: '100%', height: '100%', border: 'none' }}
            />
          </div>

          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Info size={14} color="#94a3b8" />
            <span>
              Wskazówka: Jeśli wykresy nie wyświetlają się wewnątrz ramki, upewnij się, że w konfiguracji <code>grafana.ini</code> na serwerze włączono <code>allow_embedding = true</code> w sekcji <code>[security]</code>.
            </span>
          </div>
        </div>
      )}

      {/* Main Grid: Alerts Feed + Discovered Infrastructure */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.8fr) minmax(0, 1.2fr)', gap: '1.5rem', alignItems: 'start' }}>
        
        {/* Left Column: AIOps Incident & Alert Stream */}
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldAlert size={18} color="#38bdf8" />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>Skorelowane Alerty AIOps</h3>
              <span style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.08)', padding: '0.15rem 0.5rem', borderRadius: '999px' }}>
                {filteredAlerts.length}
              </span>
            </div>

            {/* Severity Filter Buttons */}
            <div style={{ display: 'flex', gap: '0.3rem', background: 'rgba(0,0,0,0.2)', padding: '0.2rem', borderRadius: '8px' }}>
              {(['all', 'critical', 'warning', 'info'] as const).map(sev => (
                <button
                  type="button"
                  key={sev}
                  onClick={() => setSeverityFilter(sev)}
                  style={{
                    fontSize: '0.75rem',
                    padding: '0.25rem 0.6rem',
                    borderRadius: '6px',
                    border: 'none',
                    background: severityFilter === sev ? 'var(--primary)' : 'transparent',
                    color: severityFilter === sev ? '#fff' : 'var(--text-muted)',
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                    fontWeight: 600
                  }}
                >
                  {sev}
                </button>
              ))}
            </div>
          </div>

          {filteredAlerts.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              <CheckCircle2 size={32} color="#10b981" style={{ margin: '0 auto 0.5rem' }} />
              Brak aktywnych alertów w wybranej kategorii.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {filteredAlerts.map(alert => {
                const isCrit = alert.severity === 'critical';
                const isWarn = alert.severity === 'warning';
                const isResolved = alert.state === 'resolved';
                const isAcked = alert.state === 'acknowledged';

                const badgeBg = isCrit ? 'rgba(239, 68, 68, 0.15)' : isWarn ? 'rgba(245, 158, 11, 0.15)' : 'rgba(56, 189, 248, 0.15)';
                const badgeColor = isCrit ? '#f87171' : isWarn ? '#fbbf24' : '#38bdf8';
                const borderColor = isCrit ? 'rgba(239, 68, 68, 0.3)' : isWarn ? 'rgba(245, 158, 11, 0.3)' : 'rgba(56, 189, 248, 0.2)';

                return (
                  <div 
                    key={alert.id}
                    style={{
                      padding: '1rem',
                      background: 'rgba(15, 23, 42, 0.5)',
                      border: `1px solid ${borderColor}`,
                      borderRadius: '10px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          padding: '0.15rem 0.5rem',
                          borderRadius: '4px',
                          background: badgeBg,
                          color: badgeColor,
                          textTransform: 'uppercase'
                        }}>
                          {alert.severity}
                        </span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                          {alert.id}
                        </span>
                        <span style={{ 
                          fontSize: '0.7rem', 
                          padding: '0.1rem 0.45rem', 
                          borderRadius: '4px',
                          background: isResolved ? 'rgba(16, 185, 129, 0.15)' : isAcked ? 'rgba(148, 163, 184, 0.2)' : 'rgba(239, 68, 68, 0.15)',
                          color: isResolved ? '#34d399' : isAcked ? '#cbd5e1' : '#f87171',
                          fontWeight: 600
                        }}>
                          {alert.state.toUpperCase()}
                        </span>
                      </div>

                      {/* Actions */}
                      {!isResolved && (
                        <div style={{ display: 'flex', gap: '0.35rem' }}>
                          {!isAcked && (
                            <button
                              type="button"
                              onClick={() => handleAcknowledge(alert.id)}
                              style={{
                                fontSize: '0.7rem',
                                padding: '0.2rem 0.5rem',
                                borderRadius: '4px',
                                background: 'rgba(255, 255, 255, 0.08)',
                                color: 'var(--text-main)',
                                border: '1px solid var(--border-color)',
                                cursor: 'pointer'
                              }}
                              title="Potwierdź przyjęcie"
                            >
                              ACK
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleResolve(alert.id)}
                            style={{
                              fontSize: '0.7rem',
                              padding: '0.2rem 0.5rem',
                              borderRadius: '4px',
                              background: 'rgba(16, 185, 129, 0.2)',
                              color: '#34d399',
                              border: '1px solid rgba(16, 185, 129, 0.4)',
                              cursor: 'pointer'
                            }}
                            title="Oznacz jako rozwiązany"
                          >
                            Resolve
                          </button>
                        </div>
                      )}
                    </div>

                    <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-main)' }}>
                      {alert.subject}
                    </div>

                    <div style={{ 
                      fontSize: '0.8rem', 
                      background: 'rgba(0,0,0,0.25)', 
                      padding: '0.5rem 0.75rem', 
                      borderRadius: '6px',
                      color: '#cbd5e1',
                      borderLeft: `3px solid ${badgeColor}`
                    }}>
                      <strong>OpsRamp AIOps Correlation:</strong> {alert.aiCorrelationReason}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                      <span>Zasób: <strong style={{ color: 'var(--text-main)' }}>{alert.resource}</strong> ({alert.resourceType})</span>
                      <span>Zdeduplikowano: <strong>{alert.deduplicatedCount}</strong> zdarzeń</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Monitored Docker Infrastructure & Enterprise Switch */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Discovered Resources List */}
          <div className="glass-card" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <Server size={18} color="#38bdf8" />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>Odkryta Infrastruktura</h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {resources.map(res => (
                <div 
                  key={res.id}
                  style={{
                    padding: '0.75rem',
                    background: 'rgba(15, 23, 42, 0.4)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    borderRadius: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.35rem'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#f8fafc' }}>
                      {res.name}
                    </span>
                    <span style={{
                      fontSize: '0.68rem',
                      padding: '0.1rem 0.4rem',
                      borderRadius: '4px',
                      fontWeight: 600,
                      background: res.status === 'HEALTHY' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                      color: res.status === 'HEALTHY' ? '#34d399' : '#fbbf24'
                    }}>
                      {res.status}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {res.type} &bull; {res.environment}
                  </div>

                  <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Cpu size={12} /> CPU: <strong style={{ color: '#e2e8f0' }}>{res.cpuUsage}</strong>
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <HardDrive size={12} /> RAM: <strong style={{ color: '#e2e8f0' }}>{res.memoryUsage}</strong>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick SaaS Production Switch Guide */}
          <div className="glass-card" style={{ padding: '1.25rem', background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.9))' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
              <Sliders size={18} color="#c084fc" />
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
                Przejście na produkcyjny OpsRamp
              </h3>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: '1.4', margin: 0 }}>
              Gdy otrzymasz klucze od szefostwa, wystarczy w pliku <code style={{ color: '#38bdf8' }}>.env</code> zmienić:
            </p>
            <pre style={{ 
              margin: '0.6rem 0 0', 
              padding: '0.6rem', 
              background: 'rgba(0, 0, 0, 0.4)', 
              borderRadius: '6px', 
              fontSize: '0.72rem', 
              color: '#34d399',
              overflowX: 'auto'
            }}>
{`OPSRAMP_MOCK_MODE=false
OPSRAMP_TENANT_ID=<prawdziwy_tenant_id>
OPSRAMP_SERVER_URL=https://<tenant>.app.opsramp.com
OPSRAMP_TOKEN=<token_api_opsramp>`}
            </pre>
          </div>

        </div>

      </div>

    </div>
  );
}
