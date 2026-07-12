import React, { useState, useEffect } from 'react';
import { 
  Plus, X, Activity, Terminal, RefreshCw, BarChart2, 
  Trash2, Cpu, Database, HardDrive, Globe, AlertTriangle
} from 'lucide-react';

interface Widget {
  id: number;
  name: string;
  command: string;
  type: string;
  color: string;
  server_id: number | null;
}

interface CustomWidgetsProps {
  token: string;
}

const COLOR_PRESETS = [
  { value: '#6366f1', label: 'Indigo' },
  { value: '#ec4899', label: 'Pink' },
  { value: '#10b981', label: 'Emerald' },
  { value: '#f59e0b', label: 'Amber' },
  { value: '#3b82f6', label: 'Blue' },
  { value: '#8b5cf6', label: 'Purple' },
  { value: '#ef4444', label: 'Red' },
];

const CustomWidgets: React.FC<CustomWidgetsProps> = ({ token }) => {
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [results, setResults] = useState<{ [key: number]: any }>({});
  const [loading, setLoading] = useState<{ [key: number]: boolean }>({});
  const [hoveredWidgetId, setHoveredWidgetId] = useState<number | null>(null);

  const [newName, setNewName] = useState('');
  const [newCommand, setNewCommand] = useState('');
  const [newType, setNewType] = useState('number');
  const [newColor, setNewColor] = useState('#6366f1');

  useEffect(() => {
    fetchWidgets();
  }, []);

  useEffect(() => {
    if (widgets.length === 0) return;
    
    widgets.forEach(w => runWidget(w.id));
    
    const interval = setInterval(() => {
      widgets.forEach(w => runWidget(w.id));
    }, 15000); // 15 seconds

    return () => clearInterval(interval);
  }, [widgets]);

  const fetchWidgets = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/widgets', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setWidgets(data);
      }
    } catch (e) {
      console.error('Failed to fetch widgets', e);
    }
  };

  const runWidget = async (id: number) => {
    setLoading(prev => ({ ...prev, [id]: true }));
    try {
      const res = await fetch(`http://localhost:3001/api/widgets/${id}/run`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setResults(prev => ({ ...prev, [id]: data.result }));
      } else {
        setResults(prev => ({ ...prev, [id]: 'Error' }));
      }
    } catch (e) {
      setResults(prev => ({ ...prev, [id]: 'Error' }));
    } finally {
      setLoading(prev => ({ ...prev, [id]: false }));
    }
  };

  const addWidget = async () => {
    if (!newName || !newCommand) return;
    
    try {
      const res = await fetch('http://localhost:3001/api/widgets', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({
          name: newName,
          command: newCommand,
          type: newType,
          color: newColor
        })
      });
      
      if (res.ok) {
        setShowModal(false);
        setNewName('');
        setNewCommand('');
        setNewType('number');
        setNewColor('#6366f1');
        fetchWidgets();
      }
    } catch (e) {
      console.error('Failed to add widget', e);
    }
  };

  const deleteWidget = async (id: number) => {
    try {
      await fetch(`http://localhost:3001/api/widgets/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setWidgets(prev => prev.filter(w => w.id !== id));
    } catch (e) {
      console.error('Failed to delete widget', e);
    }
  };

  // Helper to pick a suitable icon based on widget name/type
  const getWidgetIcon = (name: string, type: string) => {
    const n = name.toLowerCase();
    if (n.includes('cpu') || n.includes('proc')) return <Cpu size={16} />;
    if (n.includes('db') || n.includes('sql') || n.includes('data')) return <Database size={16} />;
    if (n.includes('disk') || n.includes('space') || n.includes('fs')) return <HardDrive size={16} />;
    if (n.includes('net') || n.includes('ping') || n.includes('web') || n.includes('http')) return <Globe size={16} />;
    if (type === 'bar-chart') return <BarChart2 size={16} />;
    return <Terminal size={16} />;
  };

  return (
    <div style={{ marginTop: '2rem' }}>
      {/* Header Panel */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '1.5rem',
        padding: '0.5rem 0'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <h2 className="section-title" style={{ margin: 0, fontWeight: 700, letterSpacing: '-0.025em' }}>
            <Activity size={24} style={{ color: 'var(--primary)', filter: 'drop-shadow(0 0 8px rgba(79,70,229,0.5))' }} />
            Custom Widgets
          </h2>
          <span style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
            Real-time server metrics and custom query outputs
          </span>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="btn btn-primary"
          style={{ 
            padding: '0.5rem 1.25rem', 
            borderRadius: '12px', 
            fontSize: '0.875rem',
            boxShadow: '0 4px 20px -2px rgba(79, 70, 229, 0.4)'
          }}
        >
          <Plus size={16} />
          Add Widget
        </button>
      </div>

      {/* Widgets Grid */}
      {widgets.length === 0 ? (
        <div className="glass-card" style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center', 
          padding: '3rem 2rem',
          textAlign: 'center',
          borderStyle: 'dashed',
          borderColor: 'rgba(255,255,255,0.1)'
        }}>
          <Terminal size={40} style={{ color: 'var(--text-muted)', marginBottom: '1rem', opacity: 0.5 }} />
          <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'white', marginBottom: '0.25rem' }}>No Widgets Created</h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', maxWidth: '300px', marginBottom: '1.25rem' }}>
            Add shell command outputs as real-time interactive widgets to your dashboard.
          </p>
          <button 
            onClick={() => setShowModal(true)}
            className="btn"
            style={{ 
              background: 'rgba(255,255,255,0.05)', 
              color: 'white', 
              border: '1px solid rgba(255,255,255,0.1)',
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              fontSize: '0.825rem'
            }}
          >
            Create Your First Widget
          </button>
        </div>
      ) : (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', 
          gap: '1.25rem' 
        }}>
          {widgets.map(w => {
            const isHovered = hoveredWidgetId === w.id;
            const widgetColor = w.color || '#6366f1';
            
            return (
              <div 
                key={w.id} 
                aria-label={`Widget ${w.name}`} 
                className="glass-card"
                onMouseEnter={() => setHoveredWidgetId(w.id)}
                onMouseLeave={() => setHoveredWidgetId(null)}
                style={{ 
                  position: 'relative', 
                  overflow: 'hidden',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  minHeight: '160px',
                  border: isHovered 
                    ? `1px solid ${widgetColor}66` 
                    : '1px solid var(--glass-border)',
                  boxShadow: isHovered 
                    ? `0 8px 30px -4px ${widgetColor}22, var(--glass-shadow)`
                    : 'var(--glass-shadow)',
                  transform: isHovered ? 'translateY(-4px)' : 'none',
                  transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
              >
                {/* Header Row */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        width: '28px',
                        height: '28px',
                        borderRadius: '8px',
                        background: `${widgetColor}15`,
                        color: widgetColor,
                        border: `1px solid ${widgetColor}33`,
                        boxShadow: `inset 0 0 6px ${widgetColor}11`
                      }}>
                        {getWidgetIcon(w.name, w.type)}
                      </div>
                      <span style={{ fontWeight: 600, color: 'white', fontSize: '0.9rem' }}>
                        {w.name}
                      </span>
                    </div>
                    
                    {/* Action buttons visible on hover / active */}
                    <div style={{ 
                      display: 'flex', 
                      gap: '0.25rem', 
                      opacity: isHovered ? 1 : 0.4, 
                      transition: 'opacity 0.2s ease',
                      alignItems: 'center'
                    }}>
                      <button 
                        onClick={() => runWidget(w.id)}
                        disabled={loading[w.id]}
                        title="Force refresh"
                        style={{ 
                          background: 'rgba(255,255,255,0.05)', 
                          border: 'none', 
                          color: '#9ca3af', 
                          cursor: 'pointer', 
                          padding: '0.25rem',
                          borderRadius: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <RefreshCw 
                          size={13} 
                          style={{ 
                            animation: loading[w.id] ? 'spin 1s linear infinite' : 'none',
                            color: loading[w.id] ? widgetColor : undefined
                          }} 
                        />
                      </button>
                      <button 
                        onClick={() => deleteWidget(w.id)}
                        title="Delete widget"
                        style={{ 
                          background: 'rgba(255,255,255,0.05)', 
                          border: 'none', 
                          color: '#ef4444', 
                          cursor: 'pointer', 
                          padding: '0.25rem',
                          borderRadius: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                  
                  {/* Result Body */}
                  <div style={{ display: 'flex', alignItems: 'center', minHeight: '3.5rem', margin: '0.25rem 0' }}>
                    {loading[w.id] && !results[w.id] ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
                        <RefreshCw size={18} style={{ animation: 'spin 1.5s linear infinite' }} />
                        <span style={{ fontSize: '0.8rem' }}>Executing...</span>
                      </div>
                    ) : w.type === 'number' ? (
                      <span style={{ 
                        fontSize: '2.25rem', 
                        fontWeight: 800, 
                        color: 'white',
                        fontFamily: 'Outfit, sans-serif',
                        textShadow: `0 0 15px ${widgetColor}22`
                      }}>
                        {results[w.id] !== undefined ? results[w.id] : '--'}
                      </span>
                    ) : w.type === 'text' ? (
                      <div style={{ 
                        width: '100%',
                        padding: '0.5rem', 
                        background: 'rgba(0,0,0,0.2)', 
                        border: '1px solid rgba(255,255,255,0.05)',
                        borderRadius: '6px',
                        fontFamily: 'monospace',
                        fontSize: '0.775rem',
                        color: '#cbd5e1',
                        maxHeight: '70px',
                        overflowY: 'auto',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all'
                      }}>
                        {results[w.id] || 'No output'}
                      </div>
                    ) : w.type === 'bar-chart' ? (
                      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          <span>Value</span>
                          <span>{results[w.id] || '0'}%</span>
                        </div>
                        <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ 
                            width: `${Math.min(Math.max(parseInt(results[w.id]) || 0, 0), 100)}%`, 
                            height: '100%', 
                            background: widgetColor,
                            transition: 'width 0.5s ease-out'
                          }} />
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Footer Command */}
                <div style={{ 
                  marginTop: '0.75rem', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.35rem', 
                  color: 'var(--text-muted)', 
                  fontSize: '0.725rem', 
                  fontFamily: 'monospace',
                  background: 'rgba(0, 0, 0, 0.1)',
                  padding: '0.25rem 0.5rem',
                  borderRadius: '6px',
                  border: '1px solid rgba(255, 255, 255, 0.02)'
                }}>
                  <Terminal size={10} style={{ opacity: 0.7 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {w.command}
                  </span>
                </div>
                
                {/* Ambient glow based on widget color */}
                <div style={{ 
                  position: 'absolute', 
                  top: '-40px', 
                  right: '-40px', 
                  width: '100px', 
                  height: '100px',
                  background: widgetColor, 
                  filter: 'blur(55px)', 
                  opacity: isHovered ? 0.28 : 0.14, 
                  borderRadius: '50%', 
                  pointerEvents: 'none',
                  transition: 'opacity 0.3s ease'
                }} />
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Dialog */}
      {showModal && (
        <div role="dialog" aria-modal="true" style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          background: 'rgba(15, 23, 42, 0.75)', 
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          zIndex: 100,
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          animation: 'modalIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
          <div className="glass-card" style={{ 
            width: '420px', 
            padding: '1.75rem', 
            position: 'relative',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
            border: '1px solid rgba(255,255,255,0.08)'
          }}>
            <button 
              onClick={() => setShowModal(false)}
              aria-label="Close modal"
              style={{ 
                position: 'absolute', 
                top: '1.25rem', 
                right: '1.25rem', 
                background: 'rgba(255,255,255,0.03)', 
                border: '1px solid rgba(255,255,255,0.05)', 
                color: 'var(--text-muted)', 
                cursor: 'pointer',
                borderRadius: '8px',
                width: '30px',
                height: '30px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
            >
              <X size={16} />
            </button>
            
            <h3 style={{ margin: '0 0 1.5rem 0', color: 'white', display: 'flex', alignItems: 'center', gap: '0.65rem', fontSize: '1.25rem', fontWeight: 700 }}>
              <BarChart2 size={22} style={{ color: 'var(--primary)' }} />
              Add Custom Widget
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Widget Name
                </label>
                <input 
                  type="text" 
                  value={newName} 
                  onChange={e => setNewName(e.target.value)} 
                  placeholder="e.g., Active Node Apps"
                  style={{ 
                    width: '100%', 
                    padding: '0.65rem 0.85rem', 
                    background: 'rgba(0,0,0,0.2)', 
                    border: '1px solid rgba(255,255,255,0.1)', 
                    borderRadius: '8px', 
                    color: 'white', 
                    outline: 'none',
                    fontSize: '0.9rem',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                  onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Shell Command
                </label>
                <input 
                  type="text" 
                  value={newCommand} 
                  onChange={e => setNewCommand(e.target.value)} 
                  placeholder="pm2 status | grep online | wc -l"
                  style={{ 
                    width: '100%', 
                    padding: '0.65rem 0.85rem', 
                    background: 'rgba(0,0,0,0.2)', 
                    border: '1px solid rgba(255,255,255,0.1)', 
                    borderRadius: '8px', 
                    color: 'white', 
                    outline: 'none', 
                    fontFamily: 'monospace',
                    fontSize: '0.85rem',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                  onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <AlertTriangle size={12} style={{ color: 'var(--warning)' }} />
                  Make sure this returns output safe to display.
                </span>
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Type
                  </label>
                  <select 
                    value={newType} 
                    onChange={e => setNewType(e.target.value)}
                    style={{ 
                      width: '100%', 
                      padding: '0.65rem 0.85rem', 
                      background: 'rgba(0,0,0,0.2)', 
                      border: '1px solid rgba(255,255,255,0.1)', 
                      borderRadius: '8px', 
                      color: 'white', 
                      outline: 'none',
                      fontSize: '0.9rem'
                    }}
                  >
                    <option value="number" style={{ background: 'var(--bg-color)' }}>Counter (Number)</option>
                    <option value="text" style={{ background: 'var(--bg-color)' }}>Raw Text</option>
                    <option value="bar-chart" style={{ background: 'var(--bg-color)' }}>Progress Bar (0-100)</option>
                  </select>
                </div>
                
                <div>
                  <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Color Theme
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input 
                      type="color" 
                      value={newColor} 
                      onChange={e => setNewColor(e.target.value)}
                      style={{ 
                        padding: '0', 
                        background: 'none', 
                        border: 'none', 
                        width: '38px', 
                        height: '38px', 
                        cursor: 'pointer',
                        borderRadius: '8px',
                        overflow: 'hidden'
                      }}
                    />
                    <div style={{ display: 'flex', gap: '0.2rem' }}>
                      {COLOR_PRESETS.slice(0, 4).map(preset => (
                        <button
                          key={preset.value}
                          type="button"
                          onClick={() => setNewColor(preset.value)}
                          style={{
                            width: '16px',
                            height: '16px',
                            borderRadius: '50%',
                            background: preset.value,
                            border: newColor === preset.value ? '2px solid white' : 'none',
                            cursor: 'pointer',
                            padding: 0
                          }}
                          title={preset.label}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              
              <button 
                type="button"
                onClick={addWidget}
                className="btn btn-primary"
                style={{ 
                  marginTop: '0.75rem', 
                  padding: '0.75rem', 
                  borderRadius: '10px',
                  fontSize: '0.95rem', 
                  width: '100%',
                  fontWeight: 600
                }}
              >
                Create Widget
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomWidgets;
