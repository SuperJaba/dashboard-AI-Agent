import { useState, useEffect } from 'react';
import { BarChart3, Database, CheckCircle2 } from 'lucide-react';



export const AnalyticsPanel = () => {
  const [stats, setStats] = useState<{
    totalProjects: number;
    techStats: { tech: string; count: number }[];
    avgComplete: number;
  } | null>(null);

  useEffect(() => {
    fetch('/api/analytics', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('dashboard_token')}`
      }
    })
      .then(res => res.json())
      .then(data => setStats(data))
      .catch(console.error);
  }, []);

  if (!stats) return null;

  return (
    <div className="analytics-panel animate-in delay-1" style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: '1rem',
      marginBottom: '2rem'
    }}>
      <div className="stat-card" style={{
        background: 'var(--glass-bg)',
        border: '1px solid var(--glass-border)',
        borderRadius: '12px',
        padding: '1.2rem',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem'
      }}>
        <div style={{ padding: '0.8rem', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '50%', color: '#3b82f6' }}>
          <Database size={24} />
        </div>
        <div>
          <h4 style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Total Projects</h4>
          <p style={{ margin: '0.2rem 0 0 0', fontSize: '1.5rem', fontWeight: 600 }}>{stats.totalProjects}</p>
        </div>
      </div>

      <div className="stat-card" style={{
        background: 'var(--glass-bg)',
        border: '1px solid var(--glass-border)',
        borderRadius: '12px',
        padding: '1.2rem',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem'
      }}>
        <div style={{ padding: '0.8rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '50%', color: '#10b981' }}>
          <CheckCircle2 size={24} />
        </div>
        <div>
          <h4 style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Global Progress</h4>
          <p style={{ margin: '0.2rem 0 0 0', fontSize: '1.5rem', fontWeight: 600 }}>{Math.round(stats.avgComplete)}%</p>
        </div>
      </div>

      <div className="stat-card" style={{
        background: 'var(--glass-bg)',
        border: '1px solid var(--glass-border)',
        borderRadius: '12px',
        padding: '1.2rem',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem'
      }}>
        <div style={{ padding: '0.8rem', background: 'rgba(139, 92, 246, 0.1)', borderRadius: '50%', color: '#8b5cf6' }}>
          <BarChart3 size={24} />
        </div>
        <div>
          <h4 style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Top Technology</h4>
          <p style={{ margin: '0.2rem 0 0 0', fontSize: '1.2rem', fontWeight: 600 }}>
            {stats.techStats && stats.techStats.length > 0 
              ? stats.techStats.sort((a,b) => b.count - a.count)[0].tech 
              : 'N/A'}
          </p>
        </div>
      </div>
    </div>
  );
};
