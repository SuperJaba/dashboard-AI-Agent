import { useEffect, useState } from 'react';
import { apiFetch } from './api';
import { Activity, Cpu, Server, HardDrive } from 'lucide-react';

export function ServerStats({ serverId }: { serverId?: number }) {
  const [stats, setStats] = useState<any>(null);
  const [apps, setApps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const query = serverId ? `?serverId=${serverId}` : '';
        const statsRes = await apiFetch(`/api/system-stats${query}`);
        const statsData = await statsRes.json();
        setStats(statsData);

        const appsRes = await apiFetch(`/api/apps-scan${query}`);
        const appsData = await appsRes.json();
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

  if (loading) return <div className="text-gray-400 p-4">Loading system stats...</div>;
  if (!stats) return <div className="text-red-400 p-4">Failed to load stats.</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>
      {/* Metrics Row */}
      <div className="grid-top">
        {/* CPU */}
        <div className="glass-card animate-in delay-1" style={{ display: 'flex', flexDirection: 'column', padding: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#60a5fa', marginBottom: '0.5rem' }}>
            <Cpu size={20} />
            <span style={{ fontWeight: 600, fontSize: '1.125rem' }}>CPU Usage</span>
          </div>
          <div style={{ color: '#d1d5db', fontSize: '0.875rem', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={stats.cpu.model}>{stats.cpu.model}</span>
            <span style={{ whiteSpace: 'nowrap', marginLeft: '0.5rem', color: '#9ca3af' }}>{stats.cpu.cores} Cores</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'white' }}>{stats.cpu.load1.toFixed(2)}</span>
            <span style={{ fontSize: '0.75rem', color: '#6b7280', marginLeft: '0.5rem', textTransform: 'uppercase' }}>Load Avg (1m)</span>
          </div>
          <div style={{ width: '100%', background: 'rgba(0,0,0,0.3)', borderRadius: '999px', height: '6px', overflow: 'hidden', marginTop: 'auto' }}>
            <div 
              style={{ 
                height: '100%', 
                width: `${Math.min(100, (stats.cpu.load1 / stats.cpu.cores) * 100)}%`, 
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
                background: 'linear-gradient(90deg, #10b981, #34d399)',
                transition: 'width 0.5s ease-in-out'
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
            Wykryte Procesy (Node.js)
          </h3>
          <span style={{ background: '#334155', fontSize: '0.75rem', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', color: '#d1d5db' }}>{apps.length} aktywnych</span>
        </div>
        
        {apps.length === 0 ? (
          <div className="glass-card" style={{ padding: '1.5rem', textAlign: 'center', color: '#9ca3af', fontStyle: 'italic' }}>
            Brak wykrytych procesów Node.js na tym serwerze.
          </div>
        ) : (
          <div className="grid-top">
            {apps.map((app, i) => (
              <div key={i} className="glass-card" style={{ padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'white', fontWeight: 500, maxWidth: '70%', overflow: 'hidden' }}>
                    <span style={{ color: '#f472b6', fontFamily: 'monospace', fontSize: '0.875rem' }}>PID: {app.pid}</span>
                    <span style={{ color: '#d1d5db' }}>|</span>
                    <span style={{ fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={app.command}>{app.command.split(' ')[0]}</span>
                  </div>
                  <span style={{ background: 'rgba(99, 102, 241, 0.2)', color: '#a5b4fc', fontSize: '0.75rem', padding: '0.125rem 0.5rem', borderRadius: '0.25rem', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                    user: {app.user}
                  </span>
                </div>
                
                <div style={{ fontSize: '0.75rem', color: '#9ca3af', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '0.75rem' }} title={app.command}>
                  {app.command}
                </div>
                
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
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
