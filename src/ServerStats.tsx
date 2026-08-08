import { useEffect, useState } from 'react';
import { apiClient } from './shared/api-client';
import { Activity, Cpu, Server, HardDrive, PowerOff } from 'lucide-react';

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

  if (loading) return <div className="text-gray-400 p-4">Loading system stats...</div>;
  if (!stats || stats.error || !stats.cpu) return (
    <div style={{ padding: '1rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '0.75rem', color: '#f87171', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
      <span>⚠</span>
      <span>Nie można pobrać statystyk serwera{stats?.error ? `: ${stats.error}` : '.'}</span>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>
      {/* Metrics Row */}
      <div className="grid-top">
        {/* CPU */}
        <div className="glass-card animate-in delay-1" style={{ display: 'flex', flexDirection: 'column', padding: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#60a5fa', marginBottom: '0.5rem', paddingTop: '8px' }}>
            <Cpu size={20} />
            <span style={{ fontWeight: 600, fontSize: '1.125rem' }}>CPU Usage</span>
          </div>
          <div style={{ color: '#d1d5db', fontSize: '0.875rem', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={stats.cpu.model ?? ''}>{stats.cpu.model ?? 'N/A'}</span>
            <span style={{ whiteSpace: 'nowrap', marginLeft: '0.5rem', color: '#9ca3af' }}>{stats.cpu.cores ?? '?'} Cores</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'white' }}>{(stats.cpu.load1 ?? 0).toFixed(2)}</span>
            <span style={{ fontSize: '0.75rem', color: '#6b7280', marginLeft: '0.5rem', textTransform: 'uppercase' }}>Load Avg (1m)</span>
          </div>
          <div style={{ width: '100%', background: 'rgba(0,0,0,0.3)', borderRadius: '999px', height: '6px', overflow: 'hidden', marginTop: 'auto' }}>
            <div 
              style={{ 
                height: '100%', 
                width: `${Math.min(100, ((stats.cpu.load1 ?? 0) / (stats.cpu.cores || 1)) * 100)}%`, 
                background: 'linear-gradient(90deg, #3b82f6, #60a5fa)',
                transition: 'width 0.5s ease-in-out'
              }} 
            />
          </div>
        </div>

        {/* RAM */}
        <div className="glass-card animate-in delay-2" style={{ display: 'flex', flexDirection: 'column', padding: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#4ade80', marginBottom: '0.5rem' }}>
            <Server size={20} />
            <span style={{ fontWeight: 600, fontSize: '1.125rem' }}>Memory</span>
          </div>
          <div style={{ color: '#d1d5db', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
            {((stats.memory.used) / 1024 / 1024 / 1024).toFixed(1)} GB / {((stats.memory.total) / 1024 / 1024 / 1024).toFixed(1)} GB
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'white' }}>{stats.memory.usagePercent.toFixed(1)}%</span>
            <span style={{ fontSize: '0.75rem', color: '#6b7280', marginLeft: '0.5rem', textTransform: 'uppercase' }}>Used</span>
          </div>
          <div style={{ width: '100%', background: 'rgba(0,0,0,0.3)', borderRadius: '999px', height: '6px', overflow: 'hidden', marginTop: 'auto' }}>
            <div 
              style={{ 
                height: '100%', 
                width: `${stats.memory.usagePercent}%`, 
                background: stats.memory.usagePercent > 80 
                  ? 'linear-gradient(90deg, #ef4444, #f87171)' // Red
                  : stats.memory.usagePercent >= 50 
                    ? 'linear-gradient(90deg, #f59e0b, #fbbf24)' // Orange
                    : 'linear-gradient(90deg, #10b981, #34d399)', // Green
                transition: 'width 0.5s ease-in-out, background 0.5s ease-in-out'
              }} 
            />
          </div>
        </div>

        {/* System Info */}
        <div className="glass-card animate-in delay-3" style={{ display: 'flex', flexDirection: 'column', padding: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#c084fc', marginBottom: '0.5rem' }}>
            <Activity size={20} />
            <span style={{ fontWeight: 600, fontSize: '1.125rem' }}>System</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
              <span style={{ color: '#6b7280' }}>OS Platform</span>
              <span style={{ color: 'white' }}>{stats.os.platform}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
              <span style={{ color: '#6b7280' }}>Release</span>
              <span style={{ color: 'white' }}>{stats.os.release}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
              <span style={{ color: '#6b7280' }}>Uptime</span>
              <span style={{ color: 'white' }}>{(stats.os.uptime / 3600).toFixed(1)} hrs</span>
            </div>
          </div>
        </div>
      </div>

      {/* Discovered Apps */}
      <div className="animate-in delay-4">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <HardDrive size={22} style={{ color: '#f472b6' }} />
            Aplikacje WWW
          </h3>
          <span style={{ background: '#334155', fontSize: '0.75rem', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', color: '#d1d5db' }}>{apps.length} aktywnych</span>
        </div>
        
        {apps.length === 0 ? (
          <div className="glass-card" style={{ padding: '1.5rem', textAlign: 'center', color: '#9ca3af', fontStyle: 'italic' }}>
            Brak wykrytych aplikacji na tym serwerze.
          </div>
        ) : (
          <div className="grid-top">
            {apps.map((app, i) => (
              <div key={i} className="glass-card" style={{ padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'white', fontWeight: 500, maxWidth: '70%', overflow: 'hidden' }}>
                    {app.source === 'devil' ? (
                      <span style={{ color: '#34d399', fontFamily: 'monospace', fontSize: '0.875rem' }}>● live</span>
                    ) : (
                      <span style={{ color: '#f472b6', fontFamily: 'monospace', fontSize: '0.875rem' }}>PID: {app.pid}</span>
                    )}
                    <span style={{ color: '#d1d5db' }}>|</span>
                    <span style={{ fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={app.domain || app.command}>
                      {app.domain || app.command.split(' ')[0]}
                    </span>
                  </div>
                  <span style={{ background: app.source === 'devil' ? 'rgba(52, 211, 153, 0.15)' : 'rgba(99, 102, 241, 0.2)', color: app.source === 'devil' ? '#6ee7b7' : '#a5b4fc', fontSize: '0.75rem', padding: '0.125rem 0.5rem', borderRadius: '0.25rem', border: `1px solid ${app.source === 'devil' ? 'rgba(52,211,153,0.3)' : 'rgba(99,102,241,0.2)'}` }}>
                    {app.type || 'node'}
                  </span>
                </div>

                <div style={{ fontSize: '0.75rem', color: '#9ca3af', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '0.75rem' }} title={app.dir || app.command}>
                  {app.dir || app.command}
                </div>

                {app.source === 'devil' ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <span>user:</span>
                      <span style={{ color: '#e5e7eb' }}>{app.user}</span>
                    </div>
                    <button 
                      onClick={() => handleKillApp(app)}
                      style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                    >
                      <PowerOff size={12} />
                      Kill
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '1rem', fontSize: '0.875rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase' }}>CPU</span>
                      <span style={{ color: '#e5e7eb' }}>{app.cpu}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase' }}>RAM</span>
                      <span style={{ color: '#e5e7eb' }}>{app.mem}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
