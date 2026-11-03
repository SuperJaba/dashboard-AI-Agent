import { useState, useEffect, useCallback, useMemo } from 'react';
import { BarChart3, Database, CheckCircle2 } from 'lucide-react';
import { apiClient } from './shared/api-client/client';
import { AntigravityCard } from './components/AntigravityCard';

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
      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
      gap: '1.25rem',
      marginBottom: '2rem',
      perspective: '1200px'
    }}>
      {/* Total Projects Pod */}
      <AntigravityCard
        elevation="medium"
        maxTilt={6}
        glowColor="rgba(56, 189, 248, 0.2)"
        style={{ padding: '1.2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}
      >
        <div className="antigravity-depth-pop" style={{
          padding: '0.75rem',
          background: 'rgba(56, 189, 248, 0.12)',
          border: '1px solid rgba(56, 189, 248, 0.25)',
          borderRadius: '12px',
          color: '#38bdf8',
          boxShadow: '0 0 16px -2px rgba(56, 189, 248, 0.3)'
        }}>
          <Database size={24} />
        </div>
        <div className="antigravity-depth-sub">
          <h4 style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>Total Projects</h4>
          <p style={{ margin: '0.2rem 0 0 0', fontSize: '1.75rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em', lineHeight: 1 }}>{liveStats.totalProjects}</p>
        </div>
      </AntigravityCard>

      {/* Global Progress Pod */}
      <AntigravityCard
        elevation="medium"
        maxTilt={6}
        glowColor="rgba(52, 211, 153, 0.2)"
        style={{ padding: '1.2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}
      >
        <div className="antigravity-depth-pop" style={{
          padding: '0.75rem',
          background: 'rgba(52, 211, 153, 0.12)',
          border: '1px solid rgba(52, 211, 153, 0.25)',
          borderRadius: '12px',
          color: '#34d399',
          boxShadow: '0 0 16px -2px rgba(52, 211, 153, 0.3)'
        }}>
          <CheckCircle2 size={24} />
        </div>
        <div className="antigravity-depth-sub">
          <h4 style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>Global Progress</h4>
          <p style={{ margin: '0.2rem 0 0 0', fontSize: '1.75rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em', lineHeight: 1 }}>{liveStats.avgComplete}%</p>
        </div>
      </AntigravityCard>

      {/* Top Technology Pod */}
      <AntigravityCard
        elevation="medium"
        maxTilt={6}
        glowColor="rgba(168, 85, 247, 0.2)"
        style={{ padding: '1.2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}
      >
        <div className="antigravity-depth-pop" style={{
          padding: '0.75rem',
          background: 'rgba(168, 85, 247, 0.12)',
          border: '1px solid rgba(168, 85, 247, 0.25)',
          borderRadius: '12px',
          color: '#c084fc',
          boxShadow: '0 0 16px -2px rgba(168, 85, 247, 0.3)'
        }}>
          <BarChart3 size={24} />
        </div>
        <div className="antigravity-depth-sub">
          <h4 style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>Top Technology</h4>
          <p style={{ margin: '0.2rem 0 0 0', fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {liveStats.topTechnology}
          </p>
        </div>
      </AntigravityCard>
    </div>
  );
};
