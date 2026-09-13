import { useState } from 'react';
import { Plus } from 'lucide-react';

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

  const displayed = projects.filter(p => p.name.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div style={{
      fontFamily: '"JetBrains Mono", "Courier New", monospace',
      backgroundColor: '#000',
      color: '#00FF41',
      padding: '1.25rem',
      minHeight: '100%',
      letterSpacing: '-0.02em',
      boxSizing: 'border-box'
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700;800&display=swap');
        
        .industrial-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 0;
          border-top: 2px solid #333;
          border-left: 2px solid #333;
        }
        .industrial-tile {
          border-right: 2px solid #333;
          border-bottom: 2px solid #333;
          padding: 1rem;
          cursor: pointer;
          transition: background 0.1s, color 0.1s;
          background: #000;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        .industrial-tile:hover {
          background: #00FF41;
          color: #000;
        }
        .industrial-tile:hover .accent-text {
          color: #000 !important;
          border-color: #000 !important;
        }
        .industrial-input:focus-visible {
          outline: 2px solid #00FF41;
          outline-offset: -2px;
          border-color: #00FF41 !important;
          background: #0a0a0a !important;
        }
      `}</style>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.25rem', borderBottom: '4px solid #00FF41', paddingBottom: '0.75rem' }}>
        <div>
          <h1 style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '1.9rem', fontWeight: 800, margin: 0, textTransform: 'uppercase', lineHeight: 1, color: '#00FF41' }}>SYSTEM_INDEX</h1>
          <div style={{ fontSize: '0.8rem', marginTop: '0.4rem', color: '#888' }}>// OPERATIONAL WORKSPACES_</div>
        </div>
        
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <input 
            className="industrial-input"
            placeholder="> QUERY_DB..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
            style={{
              background: '#000',
              border: '2px solid #333',
              color: '#00FF41',
              padding: '0.5rem 0.75rem',
              fontFamily: 'inherit',
              fontSize: '0.85rem',
              width: '200px',
              textTransform: 'uppercase'
            }}
          />
          {onAddProject && (
            <button
              type="button"
              onClick={onAddProject}
              style={{
                background: '#000',
                border: '2px solid #00FF41',
                color: '#00FF41',
                padding: '0.5rem 0.85rem',
                fontFamily: 'inherit',
                fontSize: '0.85rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                textTransform: 'uppercase'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#00FF41';
                e.currentTarget.style.color = '#000';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#000';
                e.currentTarget.style.color = '#00FF41';
              }}
            >
              <Plus size={16} />
              <span>+ NEW_WORKSPACE</span>
            </button>
          )}
        </div>
      </div>

      {projects.length === 0 ? (
        <div style={{ border: '2px dashed #333', padding: '2.5rem', textAlign: 'center', color: '#666', textTransform: 'uppercase' }}>
          [ NO_RECORDS_FOUND ]
        </div>
      ) : (
        <div className="industrial-grid">
          {displayed.map(p => (
            <button type="button" key={p.id} className="industrial-tile" onClick={() => onProjectClick(p.id)} style={{ textAlign: 'left', width: '100%', font: 'inherit', margin: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, textTransform: 'uppercase', wordBreak: 'break-all', fontFamily: '"JetBrains Mono", monospace' }}>
                  {p.name}
                </h2>
                <div 
                  className="accent-text"
                  style={{
                  border: `1px solid ${p.complete === 100 ? '#00FF41' : '#F59E0B'}`,
                  padding: '2px 6px',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  color: p.complete === 100 ? '#00FF41' : '#F59E0B'
                }}>
                  [{p.complete === 100 ? 'READY' : 'BUILDING'}]
                </div>
              </div>
              
              <div style={{ fontSize: '0.8rem', color: '#888', flex: 1, textTransform: 'uppercase' }} className="accent-text">
                {p.desc || 'NO_DESC_PROVIDED'}
              </div>
              
              <div className="accent-text" style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #333', paddingTop: '0.75rem', fontSize: '0.7rem', color: '#888' }}>
                <div>TECH: {p.tech || 'UNKNOWN'}</div>
                <div>COMPLETION: {p.complete}%</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
