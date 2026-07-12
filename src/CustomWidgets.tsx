import React, { useState, useEffect } from 'react';
import { Plus, X, Activity, Terminal, RefreshCw, BarChart2 } from 'lucide-react';

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

const CustomWidgets: React.FC<CustomWidgetsProps> = ({ token }) => {
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [results, setResults] = useState<{ [key: number]: any }>({});
  const [loading, setLoading] = useState<{ [key: number]: boolean }>({});

  const [newName, setNewName] = useState('');
  const [newCommand, setNewCommand] = useState('');
  const [newType, setNewType] = useState('number');
  const [newColor, setNewColor] = useState('#8b5cf6');

  useEffect(() => {
    fetchWidgets();
  }, []);

  useEffect(() => {
    // Run widgets periodically
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

  return (
    <div style={{ marginTop: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 className="section-title" style={{ margin: 0 }}>
          <Activity size={24} color="var(--primary)" />
          Custom Widgets
        </h2>
        <button 
          onClick={() => setShowModal(true)}
          style={{ 
            display: 'flex', alignItems: 'center', gap: '0.5rem', 
            background: 'var(--primary)', color: 'white', 
            border: 'none', padding: '0.5rem 1rem', borderRadius: '0.5rem',
            cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem'
          }}
        >
          <Plus size={16} />
          Add Widget
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem' }}>
        {widgets.map(w => (
          <div key={w.id} className="glass-panel" style={{ position: 'relative', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: w.color }} />
                <span style={{ fontWeight: 600, color: '#e5e7eb', fontSize: '0.875rem' }}>{w.name}</span>
              </div>
              <button 
                onClick={() => deleteWidget(w.id)}
                style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: 0 }}
              >
                <X size={16} />
              </button>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'baseline', minHeight: '3rem', marginTop: '0.5rem' }}>
              {loading[w.id] && !results[w.id] ? (
                <RefreshCw size={20} color="#9ca3af" style={{ animation: 'spin 2s linear infinite' }} />
              ) : w.type === 'number' ? (
                <span style={{ fontSize: '2rem', fontWeight: 700, color: 'white' }}>
                  {results[w.id] !== undefined ? results[w.id] : '--'}
                </span>
              ) : w.type === 'text' ? (
                <span style={{ fontSize: '1rem', color: '#d1d5db', whiteSpace: 'pre-wrap', overflowWrap: 'break-word' }}>
                  {results[w.id] || 'No output'}
                </span>
              ) : w.type === 'bar-chart' ? (
                <span style={{ color: '#d1d5db', fontSize: '0.875rem' }}>Bar chart view coming soon</span>
              ) : null}
            </div>

            <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#6b7280', fontSize: '0.75rem', fontFamily: 'monospace' }}>
              <Terminal size={12} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.command}</span>
            </div>
            
            {/* Ambient glow based on widget color */}
            <div style={{ 
              position: 'absolute', top: '-50%', right: '-50%', width: '100px', height: '100px',
              background: w.color, filter: 'blur(50px)', opacity: 0.15, borderRadius: '50%', pointerEvents: 'none'
            }} />
          </div>
        ))}
      </div>

      {showModal && (
        <div style={{ 
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          background: 'rgba(0,0,0,0.7)', zIndex: 100,
          display: 'flex', justifyContent: 'center', alignItems: 'center'
        }}>
          <div className="glass-panel" style={{ width: '400px', padding: '1.5rem', position: 'relative' }}>
            <button 
              onClick={() => setShowModal(false)}
              style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>
            <h3 style={{ margin: '0 0 1.5rem 0', color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <BarChart2 size={20} color="var(--primary)" />
              Add Custom Widget
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', color: '#9ca3af' }}>Widget Name</label>
                <input 
                  type="text" 
                  value={newName} 
                  onChange={e => setNewName(e.target.value)} 
                  placeholder="e.g., Active Node Apps"
                  style={{ width: '100%', padding: '0.5rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.25rem', color: 'white', outline: 'none' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', color: '#9ca3af' }}>Shell Command</label>
                <input 
                  type="text" 
                  value={newCommand} 
                  onChange={e => setNewCommand(e.target.value)} 
                  placeholder="pm2 status | grep online | wc -l"
                  style={{ width: '100%', padding: '0.5rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.25rem', color: 'white', outline: 'none', fontFamily: 'monospace' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', color: '#9ca3af' }}>Type</label>
                  <select 
                    value={newType} 
                    onChange={e => setNewType(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.25rem', color: 'white', outline: 'none' }}
                  >
                    <option value="number">Counter (Number)</option>
                    <option value="text">Raw Text</option>
                    <option value="bar-chart">Bar Chart (soon)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', color: '#9ca3af' }}>Color</label>
                  <input 
                    type="color" 
                    value={newColor} 
                    onChange={e => setNewColor(e.target.value)}
                    style={{ padding: '0', background: 'none', border: 'none', width: '40px', height: '36px', cursor: 'pointer' }}
                  />
                </div>
              </div>
              
              <button 
                onClick={addWidget}
                style={{ 
                  marginTop: '0.5rem', background: 'var(--primary)', color: 'white', 
                  border: 'none', padding: '0.75rem', borderRadius: '0.5rem',
                  cursor: 'pointer', fontWeight: 600, fontSize: '1rem', width: '100%'
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
