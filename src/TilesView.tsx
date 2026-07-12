import { useState, useEffect } from 'react';
import {
  Folder, Star, Zap, Clock,
  ArrowUpRight, Play, CheckCircle2,
  Settings, Layers, ChevronRight, Search
} from 'lucide-react';
import './index.css';
import { apiFetch } from './api';

interface ProjectData {
  id: number;
  name: string;
  description: string;
  path: string;
  complete: number;
  tech: string;
  branch?: string;
  tasks: { id: number; title: string; meta: string; status: string }[];
  status: string;
  lastUpdated: string;
  members: number;
}

interface TileProps {
  project: ProjectData;
  onClick: () => void;
}

export function Tile({ project, onClick }: TileProps) {
  const statusConfig = {
    active: { color: '#10B981', text: 'Active', icon: CheckCircle2 },
    paused: { color: '#F59E0B', text: 'Paused', icon: Settings },
    onboarding: { color: '#8B5CF6', text: 'Onboarding', icon: Zap },
  };

  const status = statusConfig[project.status as keyof typeof statusConfig] || statusConfig.active;
  const StatusIcon = status.icon;

  return (
    <div
      className="tile"
      onClick={onClick}
      style={{
        cursor: 'pointer',
        background: `linear-gradient(135deg, ${status.color}15 0%, ${status.color}25 100%)`,
        border: `1px solid ${status.color}30`,
      }}
    >
      <div className="tile-header">
        <div className="tile-title-group">
          <div className="tile-icon-wrapper" style={{ color: status.color }}>
            <Folder size={20} />
          </div>
          <div>
            <h3 className="tile-project-name">{project.name}</h3>
            <p className="tile-path" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {project.path.split('/').pop()}
            </p>
          </div>
        </div>
        <div className="tile-status-badge" style={{ color: status.color }}>
          <StatusIcon size={14} />
          <span>{status.text}</span>
        </div>
      </div>

      <div className="tile-content">
        <p className="tile-description" style={{
          fontSize: '0.85rem',
          color: 'var(--text-muted)',
          marginBottom: '1rem',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          lineHeight: 1.4
        }}>
          {project.description}
        </p>

        <div className="tile-stats">
          <div className="tile-stat">
            <Clock size={14} color={status.color} />
            <span>{project.complete}%</span>
          </div>
          <div className="tile-stat">
            <Layers size={14} color={status.color} />
            <span>{project.tasks.length} tasks</span>
          </div>
          <div className="tile-stat">
            <Star size={14} color={status.color} />
            <span>{project.members} members</span>
          </div>
        </div>

        <div className="tile-footer">
          <span className="tile-last-updated">
            <ArrowUpRight size={12} color="var(--text-muted)" />
            {project.lastUpdated}
          </span>
          <button className="tile-action-btn">
            <ChevronRight size={16} color="var(--primary)" />
          </button>
        </div>
      </div>
    </div>
  );
}

interface DashboardTilesProps {
  projects: ProjectData[];
  activeProjectId: number | null;
  onProjectClick: (projectId: number) => void;
}

export function DashboardTiles({ projects, onProjectClick }: DashboardTilesProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTiles, setSelectedTiles] = useState<number[]>([]);

  const filteredProjects = projects.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleTileClick = (projectId: number) => {
    onProjectClick(projectId);
    if (selectedTiles.includes(projectId)) {
      setSelectedTiles(selectedTiles.filter(id => id !== projectId));
    } else {
      setSelectedTiles([...selectedTiles, projectId]);
    }
  };

  const toggleAllTiles = () => {
    if (selectedTiles.length === projects.length && projects.length > 0) {
      setSelectedTiles([]);
    } else {
      setSelectedTiles(projects.map(p => p.id));
    }
  };

  if (projects.length === 0) {
    return (
      <div className="tiles-section">
        <div className="empty-tiles">
          <Folder size={48} color="var(--text-muted)" />
          <h3>No projects yet</h3>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            Add your first project to get started
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="tiles-section">
      <div className="tiles-header">
        <div className="tiles-title-group">
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>
            <Layers size={24} color="var(--primary)" />
            Projects
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Select projects to view in detail
          </p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <div className="search-input-wrapper">
            <input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--glass-border)',
                borderRadius: '8px',
                padding: '0.6rem 1rem',
                color: 'var(--text-main)',
                outline: 'none',
                width: '250px'
              }}
            />
          </div>
          <button
            onClick={toggleAllTiles}
            style={{
              background: selectedTiles.length === projects.length
                ? 'rgba(16, 185, 129, 0.2)'
                : 'rgba(255,255,255,0.05)',
              border: 'none',
              padding: '0.6rem',
              borderRadius: '8px',
              color: 'var(--text-main)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            {selectedTiles.length === projects.length ? (
              <>
                <CheckCircle2 size={18} color="#10B981" />
                Deselect All
              </>
            ) : (
              <>
                <Play size={18} />
                Select All
              </>
            )}
            <span style={{ marginLeft: '0.5rem' }}>{selectedTiles.length}</span>
          </button>
        </div>
      </div>

      <div className="tiles-grid">
        {filteredProjects.map(project => (
          <Tile
            key={project.id}
            project={project}
            onClick={() => handleTileClick(project.id)}
          />
        ))}
      </div>

      {filteredProjects.length === 0 && (
        <div className="empty-results">
          <Search size={32} color="var(--text-muted)" />
          <h3>No projects found</h3>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            Try adjusting your search query
          </p>
        </div>
      )}
    </div>
  );
}

function App() {
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<number | null>(null);

  useEffect(() => {
    apiFetch('http://localhost:3001/api/projects')
      .then(res => res.json())
      .then(data => {
        if (data.length) {
          setProjects(data.map((p: any) => ({
            ...p,
            lastUpdated: 'Just now'
          })));
          setActiveProjectId(data[0].id);
        }
      })
      .catch(console.error);
  }, []);

  const handleProjectClick = (projectId: number) => {
    setActiveProjectId(projectId);
  };

  return (
    <div className="tiles-app">
      <DashboardTiles
        projects={projects}
        activeProjectId={activeProjectId}
        onProjectClick={handleProjectClick}
      />
    </div>
  );
}

export default App;
