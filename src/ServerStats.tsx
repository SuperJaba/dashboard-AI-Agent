import { useEffect, useState } from 'react';
import { apiClient } from './shared/api-client';
import { Activity, Cpu, Server, HardDrive, PowerOff, ShieldCheck, Zap } from 'lucide-react';
import { AntigravityCard } from './components/AntigravityCard';

export function ServerStats({ serverId }: { serverId?: number }) {
  const [stats, setStats] = useState<any>(null);
  const [apps, setApps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const query = serverId ? `?serverId=${serverId}` : '';
        const statsData = await apiClient.get<any>(`/api/system-stats${query}`);
        setStats(statsData);

        const appsData = await apiClient.get<any>(`/api/apps-scan${query}`);
        setApps(appsData.apps || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [serverId]);

  const handleKillApp = async (app: any) => {
    if (!confirm('Na pewno chcesz zakończyć proces / zrestartować aplikację?')) return;
    try {
      await apiClient.post<any>('/api/kill-app', {
        serverId,
        pid: app.pid,
        domain: app.domain,
        source: app.source
      });
      alert('Polecenie zostało wysłane');
    } catch (e) {
      console.error(e);
      alert('Wystąpił błąd');
    }
  };

  if (loading) {
    return (
      <div className="text-gray-400 p-6 flex items-center justify-center gap-3">
        <div className="antigravity-pulse-dot" />
        <span className="text-sm font-medium tracking-wide">Ładowanie telemetryki serwera...</span>
      </div>
    );
  }

  if (!stats || stats.error || !stats.cpu) {
    return (
      <div style={{
        padding: '1.25rem',
        background: 'rgba(239, 68, 68, 0.08)',
        border: '1px solid rgba(239, 68, 68, 0.25)',
        backdropFilter: 'blur(12px)',
        borderRadius: '1rem',
        color: '#f87171',
        fontSize: '0.875rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        marginBottom: '1.5rem',
        boxShadow: '0 10px 30px -10px rgba(239, 68, 68, 0.2)'
      }}>
        <span className="text-xl">⚠</span>
        <span>Nie można pobrać statystyk serwera{stats?.error ? `: ${stats.error}` : '.'}</span>
      </div>
    );
  }

  const cpuLoadPercent = Math.min(100, Math.round(((stats.cpu.load1 ?? 0) / (stats.cpu.cores || 1)) * 100));
  const memUsagePercent = Math.round(stats.memory.usagePercent ?? 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', marginBottom: '2.5rem' }}>
      {/* Metrics Row - Spatial Telemetry Pods */}
      <div className="grid-top" style={{ perspective: '1200px' }}>
        {/* CPU Pod */}
        <AntigravityCard
          elevation="medium"
          maxTilt={7}
          glowColor="rgba(56, 189, 248, 0.18)"
          className="animate-in delay-1"
          style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column' }}
        >
          <div className="antigravity-depth-pop" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#38bdf8' }}>
              <div style={{ padding: '0.45rem', borderRadius: '10px', background: 'rgba(56, 189, 248, 0.12)', border: '1px solid rgba(56, 189, 248, 0.25)' }}>
                <Cpu size={20} />
              </div>
              <span style={{ fontWeight: 700, fontSize: '1.05rem', letterSpacing: '-0.01em', color: '#f8fafc' }}>CPU Usage</span>
            </div>
            <span style={{
              fontSize: '0.75rem',
              color: '#38bdf8',
              background: 'rgba(56, 189, 248, 0.1)',
              padding: '0.2rem 0.55rem',
              borderRadius: '9999px',
              border: '1px solid rgba(56, 189, 248, 0.2)',
              fontWeight: 600
            }}>
              {stats.cpu.cores ?? '?'} Cores
            </span>
          </div>

          <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={stats.cpu.model ?? ''}>
            {stats.cpu.model ?? 'N/A'}
          </div>

          <div className="antigravity-depth-pop" style={{ display: 'flex', alignItems: 'baseline', marginBottom: '1rem' }}>
            <span style={{ fontSize: '1.75rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>
              {(stats.cpu.load1 ?? 0).toFixed(2)}
            </span>
            <span style={{ fontSize: '0.75rem', color: '#64748b', marginLeft: '0.6rem', textTransform: 'uppercase', fontWeight: 600 }}>
              Load Avg (1m) &bull; {cpuLoadPercent}%
            </span>
          </div>

          {/* Progress Bar with Glowing Aurora */}
          <div style={{ width: '100%', background: 'rgba(0, 0, 0, 0.45)', borderRadius: '9999px', height: '7px', overflow: 'hidden', marginTop: 'auto', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <div 
              className="antigravity-progress-glow"
              style={{ 
                height: '100%', 
                width: `${cpuLoadPercent}%`, 
                background: 'linear-gradient(90deg, #0284c7, #38bdf8)',
                borderRadius: '9999px',
                transition: 'width 0.6s cubic-bezier(0.16, 1, 0.3, 1)'
              }} 
            />
          </div>
        </AntigravityCard>

        {/* RAM Pod */}
        <AntigravityCard
          elevation="medium"
          maxTilt={7}
          glowColor={memUsagePercent > 80 ? 'rgba(244, 63, 94, 0.2)' : 'rgba(52, 211, 153, 0.18)'}
          className="animate-in delay-2"
          style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column' }}
        >
          <div className="antigravity-depth-pop" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#34d399' }}>
              <div style={{ padding: '0.45rem', borderRadius: '10px', background: 'rgba(52, 211, 153, 0.12)', border: '1px solid rgba(52, 211, 153, 0.25)' }}>
                <Server size={20} />
              </div>
              <span style={{ fontWeight: 700, fontSize: '1.05rem', letterSpacing: '-0.01em', color: '#f8fafc' }}>Memory</span>
            </div>
            <span style={{
              fontSize: '0.75rem',
              color: memUsagePercent > 80 ? '#fb7185' : '#34d399',
              background: memUsagePercent > 80 ? 'rgba(244, 63, 94, 0.12)' : 'rgba(52, 211, 153, 0.1)',
              padding: '0.2rem 0.55rem',
              borderRadius: '9999px',
              border: `1px solid ${memUsagePercent > 80 ? 'rgba(244, 63, 94, 0.25)' : 'rgba(52, 211, 153, 0.2)'}`,
              fontWeight: 600
            }}>
              {memUsagePercent}% Used
            </span>
          </div>

          <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: '0.85rem' }}>
            {((stats.memory.used) / 1024 / 1024 / 1024).toFixed(1)} GB z {((stats.memory.total) / 1024 / 1024 / 1024).toFixed(1)} GB
          </div>

          <div className="antigravity-depth-pop" style={{ display: 'flex', alignItems: 'baseline', marginBottom: '1rem' }}>
            <span style={{ fontSize: '1.75rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>
              {stats.memory.usagePercent.toFixed(1)}%
            </span>
            <span style={{ fontSize: '0.75rem', color: '#64748b', marginLeft: '0.6rem', textTransform: 'uppercase', fontWeight: 600 }}>
              Zajętość RAM
            </span>
          </div>

          {/* Memory Progress Bar */}
          <div style={{ width: '100%', background: 'rgba(0, 0, 0, 0.45)', borderRadius: '9999px', height: '7px', overflow: 'hidden', marginTop: 'auto', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <div 
              className={memUsagePercent > 80 ? 'antigravity-progress-glow-rose' : 'antigravity-progress-glow-emerald'}
              style={{ 
                height: '100%', 
                width: `${stats.memory.usagePercent}%`, 
                background: stats.memory.usagePercent > 80 
                  ? 'linear-gradient(90deg, #e11d48, #f43f5e)' 
                  : stats.memory.usagePercent >= 50 
                    ? 'linear-gradient(90deg, #d97706, #fbbf24)' 
                    : 'linear-gradient(90deg, #059669, #34d399)',
                borderRadius: '9999px',
                transition: 'width 0.6s cubic-bezier(0.16, 1, 0.3, 1), background 0.6s ease'
              }} 
            />
          </div>
        </AntigravityCard>

        {/* System Info Pod */}
        <AntigravityCard
          elevation="medium"
          maxTilt={7}
          glowColor="rgba(192, 132, 252, 0.18)"
          className="animate-in delay-3"
          style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column' }}
        >
          <div className="antigravity-depth-pop" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#c084fc' }}>
              <div style={{ padding: '0.45rem', borderRadius: '10px', background: 'rgba(192, 132, 252, 0.12)', border: '1px solid rgba(192, 132, 252, 0.25)' }}>
                <Activity size={20} />
              </div>
              <span style={{ fontWeight: 700, fontSize: '1.05rem', letterSpacing: '-0.01em', color: '#f8fafc' }}>System Info</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <ShieldCheck size={14} style={{ color: '#c084fc' }} />
              <span style={{ fontSize: '0.75rem', color: '#e2e8f0', fontWeight: 600 }}>Linux Host</span>
            </div>
          </div>

          <div className="antigravity-depth-sub" style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', marginTop: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.825rem', padding: '0.2rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <span style={{ color: '#94a3b8' }}>Platforma</span>
              <span style={{ color: '#ffffff', fontWeight: 600 }}>{stats.os.platform}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.825rem', padding: '0.2rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <span style={{ color: '#94a3b8' }}>Wydanie Jądra</span>
              <span style={{ color: '#ffffff', fontFamily: 'monospace', fontSize: '0.75rem' }}>{stats.os.release}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.825rem', padding: '0.2rem 0' }}>
              <span style={{ color: '#94a3b8' }}>Czas pracy (Uptime)</span>
              <span style={{ color: '#a7f3d0', fontWeight: 600 }}>{(stats.os.uptime / 3600).toFixed(1)} godz.</span>
            </div>
          </div>
        </AntigravityCard>
      </div>

      {/* Discovered Apps - Spatial Grid */}
      <div className="animate-in delay-4" style={{ perspective: '1200px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <h3 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{ padding: '0.4rem', borderRadius: '10px', background: 'rgba(244, 114, 182, 0.12)', border: '1px solid rgba(244, 114, 182, 0.25)' }}>
              <HardDrive size={20} style={{ color: '#f472b6' }} />
            </div>
            Aplikacje WWW
          </h3>
          <span style={{ 
            background: 'rgba(30, 41, 59, 0.8)', 
            border: '1px solid rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(10px)',
            fontSize: '0.75rem', 
            padding: '0.3rem 0.75rem', 
            borderRadius: '9999px', 
            color: '#cbd5e1',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}>
            <Zap size={12} className="text-amber-400" />
            {apps.length} aktywnych
          </span>
        </div>
        
        {apps.length === 0 ? (
          <AntigravityCard elevation="low" style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic' }}>
            Brak wykrytych aplikacji na tym serwerze.
          </AntigravityCard>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))',
            gap: '1.25rem',
            width: '100%'
          }}>
            {apps.map((app, i) => (
              <AntigravityCard 
                key={i} 
                elevation="medium"
                maxTilt={8}
                glowColor={app.source === 'devil' ? 'rgba(52, 211, 153, 0.15)' : 'rgba(99, 102, 241, 0.15)'}
                style={{ 
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  minHeight: '160px'
                }}
              >
                {/* Header row */}
                <div>
                  <div className="antigravity-depth-pop" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem', gap: '0.5rem', minWidth: 0, width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'white', fontWeight: 600, flex: 1, minWidth: 0, overflow: 'hidden' }}>
                      {app.source === 'devil' ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                          <span className="antigravity-pulse-dot" />
                          <span style={{ color: '#34d399', fontFamily: 'monospace', fontSize: '0.8rem', fontWeight: 600 }}>live</span>
                        </div>
                      ) : (
                        <span style={{ color: '#f472b6', fontFamily: 'monospace', fontSize: '0.8rem', flexShrink: 0, background: 'rgba(244, 114, 182, 0.1)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                          PID: {app.pid}
                        </span>
                      )}
                      <span style={{ color: '#475569', flexShrink: 0 }}>|</span>
                      <span 
                        style={{ fontSize: '0.9rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, color: '#f8fafc' }} 
                        title={app.domain || app.command}
                      >
                        {app.domain || app.command.split(' ')[0]}
                      </span>
                    </div>

                    <span style={{ 
                      flexShrink: 0,
                      background: app.source === 'devil' ? 'rgba(52, 211, 153, 0.12)' : 'rgba(99, 102, 241, 0.15)', 
                      color: app.source === 'devil' ? '#6ee7b7' : '#c7d2fe', 
                      fontSize: '0.75rem', 
                      fontWeight: 600,
                      padding: '0.2rem 0.55rem', 
                      borderRadius: '9999px', 
                      border: `1px solid ${app.source === 'devil' ? 'rgba(52, 211, 153, 0.25)' : 'rgba(99, 102, 241, 0.25)'}` 
                    }}>
                      {app.type || 'node'}
                    </span>
                  </div>

                  <div 
                    className="antigravity-depth-sub"
                    style={{ 
                      fontSize: '0.75rem', 
                      color: '#94a3b8', 
                      fontFamily: 'monospace', 
                      overflow: 'hidden', 
                      textOverflow: 'ellipsis', 
                      whiteSpace: 'nowrap', 
                      marginBottom: '1rem',
                      padding: '0.35rem 0.6rem',
                      background: 'rgba(0, 0, 0, 0.25)',
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.04)',
                      minWidth: 0,
                      width: '100%'
                    }} 
                    title={app.dir || app.command}
                  >
                    {app.dir || app.command}
                  </div>
                </div>

                {/* Footer telemetry / action */}
                {app.source === 'devil' ? (
                  <div className="antigravity-depth-pop" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span style={{ color: '#64748b' }}>user:</span>
                      <span style={{ color: '#e2e8f0', fontWeight: 600, background: 'rgba(255, 255, 255, 0.05)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>{app.user}</span>
                    </div>
                    <button 
                      onClick={() => handleKillApp(app)}
                      style={{ 
                        background: 'rgba(239, 68, 68, 0.12)', 
                        color: '#f87171', 
                        border: '1px solid rgba(239, 68, 68, 0.25)', 
                        padding: '0.35rem 0.75rem', 
                        borderRadius: '8px', 
                        fontSize: '0.75rem', 
                        fontWeight: 600,
                        cursor: 'pointer', 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.35rem',
                        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                        boxShadow: '0 2px 8px -2px rgba(239, 68, 68, 0.2)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(239, 68, 68, 0.22)';
                        e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.45)';
                        e.currentTarget.style.transform = 'translateY(-1px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(239, 68, 68, 0.12)';
                        e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.25)';
                        e.currentTarget.style.transform = 'translateY(0px)';
                      }}
                      title="Zrestartuj lub wyłącz aplikację"
                    >
                      <PowerOff size={13} />
                      Restart / Kill
                    </button>
                  </div>
                ) : (
                  <div className="antigravity-depth-pop" style={{ display: 'flex', gap: '1.5rem', fontSize: '0.875rem', marginTop: 'auto', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>CPU</span>
                      <span style={{ color: '#38bdf8', fontWeight: 600, fontFamily: 'monospace' }}>{app.cpu}%</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>RAM</span>
                      <span style={{ color: '#34d399', fontWeight: 600, fontFamily: 'monospace' }}>{app.mem}%</span>
                    </div>
                  </div>
                )}
              </AntigravityCard>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
