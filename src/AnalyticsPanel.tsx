import { useState, useEffect, useCallback, useMemo } from 'react';
import { BarChart3, Database, CheckCircle2 } from 'lucide-react';
import { apiClient } from './shared/api-client/client';

interface ProjectLike {
  id?: number | string;
  name?: string;
  tech?: string | null;
  complete?: number | null;
  tasks?: any;
}

export const AnalyticsPanel = ({ projects }: { projects?: ProjectLike[] }) => {
  const [stats, setStats] = useState<{
    totalProjects: number;
    techStats: { tech: string; count: number }[];
    avgComplete: number;
  } | null>(null);

  const fetchStats = useCallback(() => {
    apiClient.get<any>('/api/analytics')
      .then(data => {
        if (data && typeof data.totalProjects === 'number') {
          setStats(data);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats, projects?.length]);

  const liveStats = useMemo(() => {
    if (projects && projects.length > 0) {
      const totalProjects = projects.length;
      const totalComplete = projects.reduce((acc, p) => acc + (Number(p.complete) || 0), 0);
      const avgComplete = Math.round(totalComplete / totalProjects);

      const counts: Record<string, number> = {};
      projects.forEach(p => {
        const raw = (p.tech || '').trim();
        if (raw && raw.toLowerCase() !== 'unknown') {
          counts[raw] = (counts[raw] || 0) + 1;
        }
      });

      const techStats = Object.entries(counts).map(([tech, count]) => ({ tech, count }));
      const sorted = [...techStats].sort((a, b) => b.count - a.count);
      const topTechFromProjects = sorted[0]?.tech;
      const topTechFromStats = (stats?.techStats || []).find(s => s.tech && s.tech.toLowerCase() !== 'unknown')?.tech;
      const topTechnology = topTechFromProjects || topTechFromStats || 'N/A';

      return {
        totalProjects,
        avgComplete,
        topTechnology
      };
    }

    if (stats) {
      const sorted = (stats.techStats || [])
        .filter(t => t.tech && t.tech.toLowerCase() !== 'unknown')
        .map(t => ({
          tech: t.tech,
          count: Number(t.count) || 0
        })).sort((a, b) => b.count - a.count);

      const topTechnology = sorted[0]?.tech || 'N/A';

      return {
        totalProjects: stats.totalProjects,
        avgComplete: Math.round(stats.avgComplete || 0),
        topTechnology
      };
    }

    return null;
  }, [projects, stats]);

  if (!liveStats) return null;

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
          <p style={{ margin: '0.2rem 0 0 0', fontSize: '1.5rem', fontWeight: 600 }}>{liveStats.totalProjects}</p>
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
          <p style={{ margin: '0.2rem 0 0 0', fontSize: '1.5rem', fontWeight: 600 }}>{liveStats.avgComplete}%</p>
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
            {liveStats.topTechnology}
          </p>
        </div>
      </div>
    </div>
  );
};
