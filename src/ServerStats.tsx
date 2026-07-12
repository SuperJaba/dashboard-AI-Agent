import { useState, useEffect } from 'react';
import { apiClient } from './shared/api-client';

export function ServerStats({ serverId }: { serverId: number }) {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    apiClient.get<any>(`/api/servers/${serverId}/stats`)
      .then(setStats)
      .catch(console.error);
    
    const interval = setInterval(() => {
      apiClient.get<any>(`/api/servers/${serverId}/stats`)
        .then(setStats)
        .catch(console.error);
    }, 5000);
    return () => clearInterval(interval);
  }, [serverId]);

  if (!stats) return <div style={{ color: '#888' }}>Loading server stats...</div>;

  return (
    <div style={{ marginTop: '1rem', padding: '1rem', background: '#0a0a0a', border: '1px solid #333' }}>
      <h4 style={{ margin: '0 0 1rem 0', color: '#00FF41' }}>SERVER METRICS</h4>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
        <div>
          <div style={{ color: '#888', fontSize: '0.8rem' }}>CPU USAGE</div>
          <div style={{ fontSize: '1.2rem', color: stats.cpu > 80 ? '#FF003C' : '#fff' }}>{stats.cpu}%</div>
        </div>
        <div>
          <div style={{ color: '#888', fontSize: '0.8rem' }}>MEMORY</div>
          <div style={{ fontSize: '1.2rem', color: stats.mem > 80 ? '#FF003C' : '#fff' }}>{stats.mem}%</div>
        </div>
        <div>
          <div style={{ color: '#888', fontSize: '0.8rem' }}>DISK</div>
          <div style={{ fontSize: '1.2rem', color: stats.disk > 80 ? '#FF003C' : '#fff' }}>{stats.disk}%</div>
        </div>
      </div>
    </div>
  );
}
