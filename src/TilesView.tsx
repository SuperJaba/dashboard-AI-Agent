import { useState, useEffect } from 'react';
import { Plus, Search, Box, Grid3X3, Activity, Cpu, Sparkles, Folder } from 'lucide-react';
import { AntigravityCard } from './components/AntigravityCard';
import type { ProjectData } from './shared/api-client/schemas';

export function DashboardTiles({ 
  projects, 
  onProjectClick,
  onAddProject
}: { 
  projects: ProjectData[], 
  onProjectClick: (id: number) => void,
  onAddProject?: () => void
}) {
  const [filter, setFilter] = useState('');
  const [viewMode, setViewMode] = useState<'spatial' | 'isometric'>('spatial');
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      setReducedMotion(mediaQuery.matches);
      const listener = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
      if (typeof mediaQuery.addEventListener === 'function') {
        mediaQuery.addEventListener('change', listener);
        return () => mediaQuery.removeEventListener('change', listener);
      }
    }
  }, []);

  const displayed = projects.filter(p => p.name.toLowerCase().includes(filter.toLowerCase()));

  const isIsometric = viewMode === 'isometric' && !reducedMotion;

  return (
    <div style={{
      fontFamily: '"Outfit", "Inter", sans-serif',
      padding: '1.5rem',
      minHeight: '100%',
      letterSpacing: '-0.01em',
      boxSizing: 'border-box',
      position: 'relative'
    }}>
      {/* Top Header & View Controls Toolbar */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        flexWrap: 'wrap',
        gap: '1rem',
        marginBottom: '2rem', 
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)', 
        paddingBottom: '1.25rem' 
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(99, 102, 241, 0.2))',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              borderRadius: '12px',
              padding: '0.5rem',
              color: '#34d399',
              boxShadow: '0 0 20px -3px rgba(16, 185, 129, 0.3)'
            }}>
              <Sparkles size={22} />
            </div>
            <div>
              <h1 style={{ 
                fontSize: '1.85rem', 
                fontWeight: 800, 
                margin: 0, 
                lineHeight: 1.1, 
                color: '#ffffff',
                letterSpacing: '-0.02em',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                Obszary robocze
              </h1>
              <div style={{ fontSize: '0.78rem', marginTop: '0.25rem', color: '#94a3b8' }}>
                Aktywne obszary robocze &bull; {projects.length} projektów
              </div>
            </div>
          </div>
        </div>
        
        {/* Actions bar: Filter, View Mode Toggle, Add Workspace */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Search input with glass styling */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={15} style={{ position: 'absolute', left: '0.85rem', color: '#64748b', pointerEvents: 'none' }} />
            <input 
              className="industrial-input"
              name="workspaceFilter"
              aria-label="Filtruj obszary robocze"
              autoComplete="off"
              spellCheck={false}
              placeholder="Szukaj obszaru..."
              value={filter}
              onChange={e => setFilter(e.target.value)}
              style={{
                background: 'rgba(15, 23, 42, 0.65)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '10px',
                color: '#e2e8f0',
                padding: '0.55rem 0.85rem 0.55rem 2.25rem',
                fontSize: '0.825rem',
                width: '180px',
                outline: 'none',
                transition: 'border-color 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'rgba(52, 211, 153, 0.5)';
                e.currentTarget.style.boxShadow = '0 0 15px -3px rgba(52, 211, 153, 0.3)';
                e.currentTarget.style.width = '220px';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.width = '180px';
              }}
            />
          </div>

          {/* Perspective / Isometric Switcher */}
          {!reducedMotion && (
            <div style={{
              display: 'flex',
              background: 'rgba(15, 23, 42, 0.65)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '10px',
              padding: '2px',
              gap: '2px'
            }}>
              <button
                type="button"
                onClick={() => setViewMode('spatial')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.45rem 0.75rem',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  transition: 'all 0.2s ease',
                  background: viewMode === 'spatial' ? 'rgba(79, 70, 229, 0.25)' : 'transparent',
                  color: viewMode === 'spatial' ? '#c7d2fe' : '#94a3b8',
                  boxShadow: viewMode === 'spatial' ? '0 0 12px -2px rgba(79, 70, 229, 0.3)' : 'none'
                }}
                title="Siatka przestrzenna 3D Tilt"
              >
                <Grid3X3 size={14} />
                <span>Grid 3D</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('isometric')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.45rem 0.75rem',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  transition: 'all 0.2s ease',
                  background: viewMode === 'isometric' ? 'rgba(16, 185, 129, 0.25)' : 'transparent',
                  color: viewMode === 'isometric' ? '#6ee7b7' : '#94a3b8',
                  boxShadow: viewMode === 'isometric' ? '0 0 12px -2px rgba(16, 185, 129, 0.3)' : 'none'
                }}
                title="Rzut izometryczny (Isometric Snapping)"
              >
                <Box size={14} />
                <span>Rzut izometryczny</span>
              </button>
            </div>
          )}

          {/* Add Workspace Button */}
          {onAddProject && (
            <button
              type="button"
              onClick={onAddProject}
              style={{
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.25) 0%, rgba(5, 150, 105, 0.35) 100%)',
                border: '1px solid rgba(52, 211, 153, 0.45)',
                color: '#34d399',
                padding: '0.55rem 1rem',
                borderRadius: '10px',
                fontSize: '0.825rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                boxShadow: '0 4px 15px -3px rgba(16, 185, 129, 0.3)',
                transition: 'border-color 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 25px -4px rgba(16, 185, 129, 0.45)';
                e.currentTarget.style.borderColor = 'rgba(52, 211, 153, 0.7)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0px)';
                e.currentTarget.style.boxShadow = '0 4px 15px -3px rgba(16, 185, 129, 0.3)';
                e.currentTarget.style.borderColor = 'rgba(52, 211, 153, 0.45)';
              }}
            >
              <Plus size={16} />
              <span>+ Nowy projekt</span>
            </button>
          )}
        </div>
      </div>

      {projects.length === 0 ? (
        <AntigravityCard elevation="low" style={{ padding: '3.5rem 2rem', textAlign: 'center', color: '#94a3b8' }}>
          <Folder size={42} style={{ color: '#475569', margin: '0 auto 1rem auto' }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc', marginBottom: '0.5rem' }}>Brak skonfigurowanych projektów</h3>
          <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Kliknij "+ Nowy projekt", aby dodać pierwszy katalog roboczy.</p>
        </AntigravityCard>
      ) : (
        /* Perspective / Isometric Wrapper */
        <div style={{
          perspective: isIsometric ? '1600px' : '1200px',
          perspectiveOrigin: '50% 20%',
          transition: 'perspective 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
          paddingTop: isIsometric ? '2rem' : '0rem',
          paddingBottom: isIsometric ? '6rem' : '0rem',
          overflow: isIsometric ? 'visible' : 'hidden'
        }}>
          <div 
            className="industrial-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 310px), 1fr))',
              gap: isIsometric ? '2rem' : '1.5rem',
              transform: isIsometric 
                ? 'rotateX(52deg) rotateZ(-30deg) translateZ(0px) scale(0.92)' 
                : 'rotateX(0deg) rotateZ(0deg) translateZ(0px) scale(1)',
              transformStyle: 'preserve-3d',
              transition: 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1), gap 0.6s ease',
              width: '100%',
              margin: '0 auto'
            }}
          >
            {displayed.map((p, idx) => {
              const isReady = p.complete === 100;
              const glowColor = isReady ? 'rgba(52, 211, 153, 0.22)' : 'rgba(245, 158, 11, 0.22)';
              const animDelay = `${Math.min(idx * 0.08, 0.6)}s`;

              return (
                <div 
                  key={p.id}
                  style={{
                    transformStyle: 'preserve-3d',
                    animation: `fade-in-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${animDelay} backwards`
                  }}
                >
                  <AntigravityCard
                    elevation="medium"
                    maxTilt={isIsometric ? 4 : 8}
                    glowColor={glowColor}
                    style={{
                      height: '100%',
                      minHeight: '210px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      padding: '1.35rem',
                      cursor: 'pointer',
                      transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s ease'
                    }}
                    onMouseEnter={isIsometric ? (e) => {
                      e.currentTarget.style.transform = 'translateZ(35px) scale(1.04)';
                      e.currentTarget.style.boxShadow = `0 30px 60px -10px rgba(0,0,0,0.7), 0 0 35px 2px ${glowColor}`;
                    } : undefined}
                    onMouseLeave={isIsometric ? (e) => {
                      e.currentTarget.style.transform = 'translateZ(0px) scale(1)';
                      e.currentTarget.style.boxShadow = '';
                    } : undefined}
                  >
                    {/* Native button element preserved for full accessibility and tests */}
                    <button 
                      type="button" 
                      className="industrial-tile" 
                      onClick={() => onProjectClick(p.id)} 
                      style={{ 
                        textAlign: 'left', 
                        width: '100%', 
                        font: 'inherit', 
                        margin: 0,
                        padding: 0,
                        border: 'none',
                        background: 'transparent',
                        color: 'inherit',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        height: '100%',
                        gap: '1rem',
                        transformStyle: 'preserve-3d'
                      }}
                    >
                      {/* Top Header Row with Z-pop */}
                      <div className="antigravity-depth-pop" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', width: '100%' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flex: 1, minWidth: 0 }}>
                          <div style={{
                            padding: '0.4rem',
                            borderRadius: '8px',
                            background: isReady ? 'rgba(52, 211, 153, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                            border: `1px solid ${isReady ? 'rgba(52, 211, 153, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                            color: isReady ? '#34d399' : '#fbbf24',
                            flexShrink: 0
                          }}>
                            <Folder size={18} />
                          </div>
                          <h2 style={{ 
                            margin: 0, 
                            fontSize: '1.15rem', 
                            fontWeight: 700, 
                            letterSpacing: '-0.01em', 
                            color: '#ffffff',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {p.name.split(/[/\\]/).filter(Boolean).pop() || p.name}
                          </h2>
                        </div>

                        {/* Status Badge */}
                        <div 
                          className="accent-text"
                          style={{
                            border: `1px solid ${isReady ? 'rgba(52, 211, 153, 0.35)' : 'rgba(245, 158, 11, 0.35)'}`,
                            background: isReady ? 'rgba(52, 211, 153, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                            padding: '0.2rem 0.55rem',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            borderRadius: '9999px',
                            color: isReady ? '#34d399' : '#fbbf24',
                            letterSpacing: '0.04em',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            flexShrink: 0
                          }}
                        >
                          {isReady && <span className="antigravity-pulse-dot" style={{ width: 5, height: 5 }} />}
                          [{isReady ? 'READY' : 'BUILDING'}]
                        </div>
                      </div>
                      
                      {/* Description with subtle depth */}
                      <div 
                        className="accent-text antigravity-depth-sub" 
                        style={{ 
                          fontSize: '0.825rem', 
                          color: '#94a3b8', 
                          lineHeight: 1.45,
                          flex: 1,
                          overflow: 'hidden',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical'
                        }}
                      >
                        {p.desc || 'Brak opisu projektu'}
                      </div>

                      {/* Progress Bar with Aurora Glow */}
                      <div className="antigravity-depth-sub" style={{ width: '100%' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#64748b', marginBottom: '0.35rem', fontWeight: 600, textTransform: 'uppercase' }}>
                          <span>Postęp</span>
                          <span style={{ color: isReady ? '#34d399' : '#c7d2fe' }}>{p.complete}%</span>
                        </div>
                        <div style={{ background: 'rgba(0,0,0,0.4)', height: '6px', borderRadius: '9999px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
                          <div 
                            style={{ 
                              background: isReady 
                                ? 'linear-gradient(90deg, #059669, #34d399)' 
                                : 'linear-gradient(90deg, #4f46e5, #ec4899)', 
                              width: `${p.complete}%`, 
                              height: '100%', 
                              borderRadius: '9999px',
                              boxShadow: isReady ? '0 0 10px rgba(52, 211, 153, 0.4)' : '0 0 10px rgba(99, 102, 241, 0.4)',
                              transition: 'width 0.6s cubic-bezier(0.16, 1, 0.3, 1)' 
                            }} 
                          />
                        </div>
                      </div>
                      
                      {/* Footer telemetry row */}
                      <div 
                        className="accent-text antigravity-depth-pop" 
                        style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center',
                          borderTop: '1px solid rgba(255, 255, 255, 0.06)', 
                          paddingTop: '0.75rem', 
                          fontSize: '0.75rem', 
                          color: '#94a3b8',
                          width: '100%'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <Cpu size={13} style={{ color: '#818cf8' }} />
                          <span style={{ color: '#cbd5e1', fontWeight: 600 }}>{p.tech || 'Node.js'}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontFamily: 'monospace' }}>
                          <Activity size={13} style={{ color: isReady ? '#34d399' : '#fbbf24' }} />
                          <span>ID: #{p.id}</span>
                        </div>
                      </div>
                    </button>
                  </AntigravityCard>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
