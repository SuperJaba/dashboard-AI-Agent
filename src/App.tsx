import { useState, useEffect } from 'react';
import { 
  Folder, Plus, TerminalSquare, GitBranch, 
  Clock, Activity, ChevronDown, ChevronUp, Rocket, Save, CheckCircle2,
  Trash2, PlusCircle, LayoutDashboard, CircleDashed 
} from 'lucide-react';
import './index.css';
import { TerminalView } from './TerminalView';
import { AnalyticsPanel } from './AnalyticsPanel';

import { ServerStats } from './ServerStats';

import { apiFetch } from './api';

function App() {
  const [activeView, setActiveView] = useState<'dashboard' | 'agents'>('dashboard');
  const [projects, setProjects] = useState<any[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<number | string | null>(null);
  const [servers, setServers] = useState<any[]>([]);
  const [showAddServer, setShowAddServer] = useState(false);
  const [newServer, setNewServer] = useState({ name: '', host: '', username: '', port: 22 });
  const [remotePrompt, setRemotePrompt] = useState('');
  const [isWorkspacesExpanded, setIsWorkspacesExpanded] = useState(true);
  const [isRemoteExpanded, setIsRemoteExpanded] = useState(true);
  const [showTasks, setShowTasks] = useState(false);
  const [useBrowserTerminal, setUseBrowserTerminal] = useState(false);
  const [terminalConfig, setTerminalConfig] = useState<any>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<number[]>([]);
  const [deploying, setDeploying] = useState<string | null>(null);
  const [customLlmUrl, setCustomLlmUrl] = useState('');
  const [customApiKey, setCustomApiKey] = useState('');
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  useEffect(() => {
    apiFetch('http://localhost:3001/api/projects')
      .then(res => res.json())
      .then(data => {
        if (data.length) {
          setProjects(data);
          setActiveProjectId(data[0].id);
        }
      })
      .catch(console.error);

    apiFetch('http://localhost:3001/api/servers')
      .then(res => res.json())
      .then(data => {
        if (data.length) setServers(data);
      })
      .catch(console.error);

    apiFetch('http://localhost:3001/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data.llmUrl) setCustomLlmUrl(data.llmUrl);
        if (data.apiKey) setCustomApiKey(data.apiKey);
        
        // Sync terminal preference
        const localPref = localStorage.getItem('useBrowserTerminal');
        if (localPref !== null) {
          setUseBrowserTerminal(localPref === 'true');
        } else if (data.useBrowserTerminal !== undefined) {
          setUseBrowserTerminal(data.useBrowserTerminal === 'true');
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    setSelectedTaskIds([]);
  }, [activeProjectId]);

  const activeProject = typeof activeProjectId === 'number' ? projects.find(p => p.id === activeProjectId) || null : null;
  const activeServer = typeof activeProjectId === 'string' && activeProjectId.startsWith('server-') 
    ? servers.find(s => s.id === parseInt(activeProjectId.replace('server-', ''))) || null
    : null;

  const saveSettings = async () => {
    try {
      await apiFetch('http://localhost:3001/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ llmUrl: customLlmUrl, apiKey: customApiKey, useBrowserTerminal })
      });
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleTerminalToggle = (checked: boolean) => {
    setUseBrowserTerminal(checked);
    localStorage.setItem('useBrowserTerminal', checked.toString());
    apiFetch('http://localhost:3001/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ useBrowserTerminal: checked })
    }).catch(console.error);
  };

  const deployAgent = async (agent: string) => {
    if (!activeProject) return;
    setDeploying(agent);
    try {
      const selectedTasks = (activeProject.tasks || []).filter((t: any) => selectedTaskIds.includes(t.id));
      const res = await apiFetch('http://localhost:3001/api/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          agent, 
          directory: activeProject.path, 
          llmUrl: customLlmUrl, 
          apiKey: customApiKey,
          tasks: selectedTasks,
          useBrowserTerminal
        })
      });
      const data = await res.json();
      if (data.browserTerminal) {
        setTerminalConfig({
          command: data.command,
          args: data.args,
          cwd: data.cwd,
          env: data.env
        });
      }
    } catch (err) {
      console.error(err);
    }
    setDeploying(null);
  };


  const deployRemoteAgent = async (agent: string, server: any) => {
    setDeploying(agent);
    try {
      const res = await apiFetch('http://localhost:3001/api/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          agent, 
          directory: '', 
          llmUrl: customLlmUrl, 
          apiKey: customApiKey,
          remoteServer: server,
          remotePrompt,
          useBrowserTerminal
        })
      });
      const data = await res.json();
      if (data.browserTerminal) {
        setTerminalConfig({
          command: data.command,
          args: data.args,
          cwd: data.cwd,
          env: data.env
        });
      }
    } catch (err) {
      console.error(err);
    }
    setDeploying(null);
  };

  const analyzeProject = async () => {
    if (!activeProject) return;
    setDeploying('analyze');
    try {
      const res = await apiFetch('http://localhost:3001/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ directory: activeProject.path })
      });
      const data = await res.json();
      if (!data.error) {
        // Merge tasks: keep existing, add new ones from disk
        const currentTasks = activeProject.tasks || [];
        const existingTitles = new Set(currentTasks.map((t: any) => t.title));
        const newTasks = data.tasks.filter((t: any) => !existingTitles.has(t.title));
        
        // Ensure unique IDs
        let maxId = currentTasks.length > 0 ? Math.max(...currentTasks.map((t: any) => t.id)) : 0;
        const tasksToAdd = newTasks.map((t: any) => ({ ...t, id: ++maxId }));
        
        const mergedTasks = [...currentTasks, ...tasksToAdd];
        const updatedComplete = mergedTasks.length ? Math.round((mergedTasks.filter(t => t.status === 'completed').length / mergedTasks.length) * 100) : 0;
        
        await apiFetch(`http://localhost:3001/api/projects/${activeProject.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tech: data.tech, tasks: mergedTasks, complete: updatedComplete, branch: data.branch || null })
        });
        
        setProjects(prevProjects => prevProjects.map(p => 
          p.id === activeProject.id 
            ? { ...p, tech: data.tech, tasks: mergedTasks, complete: updatedComplete, branch: data.branch || null }
            : p
        ));
        setShowTasks(true);
      } else {
        console.error('Analysis error:', data.error);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setDeploying(null);
    }
  };

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject || !newTaskTitle.trim()) return;
    
    const currentTasks = activeProject.tasks || [];
    let maxId = currentTasks.length > 0 ? Math.max(...currentTasks.map((t: any) => t.id)) : 0;
    const newTask = { id: maxId + 1, title: newTaskTitle.trim(), meta: 'Custom Task', status: 'pending' };
    const mergedTasks = [...currentTasks, newTask];
    const updatedComplete = mergedTasks.length > 0 ? Math.round((mergedTasks.filter(t => t.status === 'completed').length / mergedTasks.length) * 100) : 0;
    
    await apiFetch(`http://localhost:3001/api/projects/${activeProject.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tasks: mergedTasks, complete: updatedComplete })
    });
    
    setProjects(projects.map(p => 
      p.id === activeProject.id ? { ...p, tasks: mergedTasks, complete: updatedComplete } : p
    ));
    setNewTaskTitle('');
  };

  const deleteTask = async (taskId: number) => {
    if (!activeProject) return;
    const mergedTasks = (activeProject.tasks || []).filter((t: any) => t.id !== taskId);
    const updatedComplete = mergedTasks.length > 0 ? Math.round((mergedTasks.filter((t: any) => t.status === 'completed').length / mergedTasks.length) * 100) : 0;
    
    await apiFetch(`http://localhost:3001/api/projects/${activeProject.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tasks: mergedTasks, complete: updatedComplete })
    });
    
    setProjects(projects.map(p => 
      p.id === activeProject.id ? { ...p, tasks: mergedTasks, complete: updatedComplete } : p
    ));
    setSelectedTaskIds(selectedTaskIds.filter(id => id !== taskId));
  };

  const initGit = async () => {
    if (!activeProject) return;
    try {
      const res = await apiFetch('http://localhost:3001/api/init-git', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ directory: activeProject.path })
      });
      const data = await res.json();
      if (data.success) {
        await apiFetch(`http://localhost:3001/api/projects/${activeProject.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ branch: data.branch })
        });
        setProjects(projects.map(p => 
          p.id === activeProject.id ? { ...p, branch: data.branch } : p
        ));
      }
    } catch (e) {
      console.error(e);
    }
  };


  const handleAddServer = async () => {
    try {
      const res = await apiFetch('http://localhost:3001/api/servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newServer)
      });
      const data = await res.json();
      setServers([...servers, data]);
      setShowAddServer(false);
      setNewServer({ name: '', host: '', username: '', port: 22 });
    } catch (e) { console.error(e); }
  };
  
  const deleteServer = async (id: number, e: any) => {
    e.stopPropagation();
    try {
      await apiFetch(`http://localhost:3001/api/servers/${id}`, { method: 'DELETE' });
      setServers(servers.filter(s => s.id !== id));
      if (activeProjectId === `server-${id}`) setActiveProjectId(null);
    } catch (e) { console.error(e); }
  };

  const handleAddProject = async () => {
    try {
      const res = await apiFetch('http://localhost:3001/api/pick-folder');
      if (res.status === 204) return;
      
      const data = await res.json();
      if (data.error || !data.path) return;
      
      const path = data.path;
      const folderName = path.split('/').pop() || path.split('\\').pop() || `New Project`;
      
      const createRes = await apiFetch('http://localhost:3001/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: folderName, desc: 'Local workspace', path })
      });
      const newProject = await createRes.json();
      
      setProjects([...projects, newProject]);
      setActiveProjectId(newProject.id);
      setShowTasks(false);
    } catch (err) {
      console.error('Failed to pick folder:', err);
    }
  };

  return (
    <div className="layout">
      {/* Sidebar */}
            <aside className="sidebar">
        {/* Workspaces Section */}
        <div 
          className="sidebar-title" 
          onClick={() => setIsWorkspacesExpanded(!isWorkspacesExpanded)}
          style={{ cursor: 'pointer', userSelect: 'none' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <LayoutDashboard size={20} />
            Workspaces
          </div>
          {isWorkspacesExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
        
        {isWorkspacesExpanded && (
          <div className="projects-list">
            {projects.map(proj => (
              <div 
                key={proj.id} 
                className={`project-item ${activeProjectId === proj.id ? 'active' : ''}`}
                onClick={() => setActiveProjectId(proj.id)}
              >
                <Folder size={18} />
                <span>{proj.name}</span>
              </div>
            ))}
            <button className="btn-add-project" onClick={handleAddProject}>
              <Plus size={18} />
              Add Project
            </button>
          </div>
        )}

        {/* Remote Servers Section */}
        <div 
          className="sidebar-title" 
          onClick={() => setIsRemoteExpanded(!isRemoteExpanded)}
          style={{ cursor: 'pointer', userSelect: 'none', marginTop: '1rem' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <TerminalSquare size={20} />
            Remote
          </div>
          {isRemoteExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
        
        {isRemoteExpanded && (
          <div className="projects-list">
            {servers.map(server => (
              <div 
                key={server.id} 
                className={`project-item ${activeProjectId === `server-${server.id}` ? 'active' : ''}`}
                onClick={() => setActiveProjectId(`server-${server.id}`)}
                style={{ justifyContent: 'space-between' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Activity size={18} />
                  <span>{server.name}</span>
                </div>
                <button 
                  onClick={(e) => deleteServer(server.id, e)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <button className="btn-add-project" onClick={() => setShowAddServer(true)}>
              <Plus size={18} />
              Add Server
            </button>
          </div>
        )}

        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <span className="info-label" style={{ fontSize: '0.75rem', marginBottom: '0' }}>Custom LLM (LM Studio)</span>
          <input 
            type="text" 
            placeholder="http://localhost:1234/v1" 
            value={customLlmUrl}
            onChange={(e) => setCustomLlmUrl(e.target.value)}
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '0.5rem', color: 'white', fontFamily: 'var(--mono)', fontSize: '0.85rem' }}
          />
          <span className="info-label" style={{ fontSize: '0.75rem', marginBottom: '0', marginTop: '0.5rem' }}>API Key (OpenAI / LM)</span>
          <input 
            type="password" 
            placeholder="sk-..." 
            value={customApiKey}
            onChange={(e) => setCustomApiKey(e.target.value)}
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '0.5rem', color: 'white', fontFamily: 'var(--mono)', fontSize: '0.85rem' }}
          />
          <button 
            onClick={saveSettings}
            style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'center', background: settingsSaved ? '#10B981' : 'rgba(255,255,255,0.1)', border: 'none', padding: '0.5rem', borderRadius: '8px', color: 'white', cursor: 'pointer', marginTop: '0.2rem', transition: '0.3s' }}
          >
            {settingsSaved ? <CheckCircle2 size={16} /> : <Save size={16} />}
            {settingsSaved ? 'Saved to DB!' : 'Save Settings'}
          </button>
        </div>
      </aside>

      {/* Main Area */}
      <div className="dashboard-container">
        {activeServer ? (
          <div style={{ height: '100%', overflowY: 'auto' }}>
            <header className="header animate-in delay-1" style={{ alignItems: 'flex-start' }}>
              <div>
                <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <TerminalSquare size={28} color="var(--primary)" />
                  {activeServer.name}
                </h1>
                <p style={{ color: 'var(--text-muted)' }}>{activeServer.username}@{activeServer.host}:{activeServer.port}</p>
              </div>
            </header>
            
            <ServerStats />
            
            <div className="grid-top" style={{ marginBottom: '2rem' }}>
              <div className="glass-card animate-in delay-2" style={{ gridColumn: '1 / -1' }}>
                <span className="info-label" style={{ marginBottom: '1rem', display: 'block' }}>Agent Operations</span>
                
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                  <button 
                    className="btn btn-secondary"
                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}
                    onClick={() => setRemotePrompt('Skopiuj wybrane pliki i foldery do określonej ścieżki na tym serwerze.')}
                  >
                    📂 Copy Files
                  </button>
                  <button 
                    className="btn btn-secondary"
                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}
                    onClick={() => setRemotePrompt('Uruchom skrypt aktualizacji na tym serwerze i zaraportuj wyniki.')}
                  >
                    ⚡ Run Script
                  </button>
                  <button 
                    className="btn btn-secondary"
                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}
                    onClick={() => setRemotePrompt('Przeanalizuj logi systemowe w poszukiwaniu błędów i przygotuj raport.')}
                  >
                    📋 Analyze Logs
                  </button>
                  <button 
                    className="btn btn-secondary"
                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', background: 'rgba(236, 72, 153, 0.1)', color: '#ec4899', border: '1px solid rgba(236,72,153,0.2)' }}
                    onClick={() => setRemotePrompt('Użyj skilla grafana-dashboards, aby przygotować pliki konfiguracyjne. Następnie połącz się przez SSH z tym serwerem, zainstaluj Dockera (jeśli nie ma) i uruchom stos Prometheus + Grafana za pomocą docker-compose z wygenerowanymi dashboardami na porcie 3000.')}
                  >
                    🔥 Deploy Grafana Stack
                  </button>
                </div>

                <textarea 
                  value={remotePrompt}
                  onChange={e => setRemotePrompt(e.target.value)}
                  placeholder="e.g., Check PHP logs for errors, update packages, or install Grafana..."
                  style={{ 
                    width: '100%', minHeight: '100px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', 
                    borderRadius: '6px', padding: '0.75rem', color: 'var(--text-main)', marginBottom: '1rem', resize: 'vertical'
                  }}
                />
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button 
                    className="btn btn-primary" 
                    onClick={() => deployRemoteAgent('claude', activeServer)}
                    disabled={deploying !== null || !remotePrompt.trim()}
                    style={{ opacity: (deploying === 'claude' || !remotePrompt.trim()) ? 0.7 : 1 }}
                  >
                    <Rocket size={18} />
                    {deploying === 'claude' ? 'Deploying...' : 'Deploy Claude'}
                  </button>
                  <button 
                    className="btn btn-primary" 
                    onClick={() => deployRemoteAgent('agy', activeServer)}
                    disabled={deploying !== null || !remotePrompt.trim()}
                    style={{ background: 'linear-gradient(135deg, #10B981, #059669)', opacity: (deploying === 'agy' || !remotePrompt.trim()) ? 0.7 : 1 }}
                  >
                    <Rocket size={18} />
                    {deploying === 'agy' ? 'Deploying...' : 'Deploy Agy'}
                  </button>
                </div>
                
                {terminalConfig && (
                  <TerminalView
                    config={terminalConfig}
                    onClose={() => setTerminalConfig(null)}
                  />
                )}
              </div>
            </div>
          </div>
        ) : activeProject ? (
          <>
            <header className="header animate-in delay-1" style={{ alignItems: 'flex-start' }}>
              <div>
                <h1>{activeProject.name}</h1>
                <p style={{ color: 'var(--text-muted)' }}>{activeProject.desc}</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.75rem' }}>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button 
                    className="btn btn-primary" 
                    onClick={() => deployAgent('claude')}
                    disabled={deploying !== null}
                    style={{ opacity: deploying === 'claude' ? 0.7 : 1 }}
                  >
                    <Rocket size={20} />
                    {deploying === 'claude' ? 'Deploying...' : 'Deploy Claude'}
                  </button>
                  <button 
                    className="btn btn-primary" 
                    onClick={() => deployAgent('agy')}
                    disabled={deploying !== null}
                    style={{ background: 'linear-gradient(135deg, #10B981, #059669)', opacity: deploying === 'agy' ? 0.7 : 1 }}
                  >
                    <Rocket size={20} />
                    {deploying === 'agy' ? 'Deploying...' : 'Deploy Agy'}
                  </button>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)', cursor: 'pointer', paddingRight: '0.25rem' }}>
                    <input 
                      type="checkbox" 
                      checked={useBrowserTerminal}
                      onChange={(e) => handleTerminalToggle(e.target.checked)}
                      style={{ accentColor: 'var(--primary)', width: '16px', height: '16px' }}
                    />
                    Use Browser Terminal
                  </label>
                </div>
                {terminalConfig && (
                  <TerminalView
                    config={terminalConfig}
                    onClose={() => setTerminalConfig(null)}
                  />
                )}
              </div>
            </header>

            <main>
              <AnalyticsPanel />
              <div className="grid-top" style={{ marginBottom: '2rem' }}>
                <div className="glass-card animate-in delay-2">
                  <span className="info-label">Implementation Status</span>
                  <div className="info-value">
                    <Activity size={24} color="var(--secondary)" />
                    {activeProject.complete}% Complete
                  </div>
                  <div style={{ marginTop: '1rem', background: 'rgba(255,255,255,0.1)', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ background: 'linear-gradient(90deg, var(--primary), var(--secondary))', width: `${activeProject.complete}%`, height: '100%', transition: 'width 0.5s ease-out' }}></div>
                  </div>
                </div>

                <div className="glass-card animate-in delay-2" style={{ animationDelay: '0.25s', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <span className="info-label">Technology Stack</span>
                    <div className="info-value">
                      <TerminalSquare size={24} color="var(--primary)" />
                      {activeProject.tech}
                    </div>
                  </div>
                  <button 
                    className="btn-add-project" 
                    style={{ marginTop: '1rem', width: 'fit-content', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }} 
                    onClick={analyzeProject}
                    disabled={deploying === 'analyze'}
                  >
                    {deploying === 'analyze' ? 'Analyzing...' : 'Analyze Workspace'}
                  </button>
                </div>

                <div className="glass-card animate-in delay-2" style={{ animationDelay: '0.3s' }}>
                  <span className="info-label">Project Path</span>
                  <div className="info-value" style={{ fontSize: '1rem' }}>
                    <Folder size={20} color="#10B981" />
                    {activeProject.path}
                  </div>
                  <div className="info-value" style={{ fontSize: '1rem', marginTop: '0.5rem' }}>
                    <GitBranch size={20} color="#F59E0B" />
                    {activeProject.branch ? (
                      activeProject.branch
                    ) : (
                      <button className="btn-add-project" style={{ marginLeft: '0.5rem', padding: '0.2rem 0.6rem', fontSize: '0.75rem' }} onClick={initGit}>
                        Create Git
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <section className="glass-card animate-in delay-3">
                <div className="tasks-header" onClick={() => setShowTasks(!showTasks)}>
                  <h2 className="section-title">
                    <Clock size={24} color="var(--primary)" />
                    Current Tasks ({(activeProject.tasks || []).length})
                  </h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    {showTasks && (
                      <button 
                        className="btn-add-project" 
                        style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem', zIndex: 2 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (selectedTaskIds.length === (activeProject.tasks || []).length && (activeProject.tasks || []).length > 0) {
                            setSelectedTaskIds([]);
                          } else {
                            setSelectedTaskIds((activeProject.tasks || []).map((t: any) => t.id));
                          }
                        }}
                      >
                        {selectedTaskIds.length === (activeProject.tasks || []).length && (activeProject.tasks || []).length > 0 ? 'Uncheck All' : 'Check All'}
                      </button>
                    )}
                    {showTasks ? <ChevronUp size={24} color="var(--text-muted)" /> : <ChevronDown size={24} color="var(--text-muted)" />}
                  </div>
                </div>
                
                {showTasks && (
                  <div className="task-list animate-in">
                    {(activeProject.tasks || []).map((task: any) => (
                      <div 
                        className="task-item" 
                        key={task.id}
                        onClick={() => {
                          if (selectedTaskIds.includes(task.id)) {
                            setSelectedTaskIds(selectedTaskIds.filter(id => id !== task.id));
                          } else {
                            setSelectedTaskIds([...selectedTaskIds, task.id]);
                          }
                        }}
                        style={{ 
                          cursor: 'pointer', 
                          border: selectedTaskIds.includes(task.id) 
                            ? (task.status === 'completed' ? '1px solid #f59e0b' : '1px solid var(--primary)') 
                            : '1px solid transparent',
                          background: selectedTaskIds.includes(task.id) 
                            ? (task.status === 'completed' ? 'rgba(245, 158, 11, 0.05)' : 'rgba(16, 185, 129, 0.05)') 
                            : 'rgba(255,255,255,0.02)',
                          opacity: (task.status === 'completed' && !selectedTaskIds.includes(task.id)) ? 0.6 : 1
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <input 
                              type="checkbox" 
                              checked={selectedTaskIds.includes(task.id)}
                              readOnly
                              style={{ 
                                width: '16px', 
                                height: '16px', 
                                accentColor: task.status === 'completed' ? '#f59e0b' : 'var(--primary)', 
                                cursor: 'pointer' 
                              }}
                            />
                            <div className="task-info">
                              <span className="task-title">{task.title}</span>
                              <span className="task-meta">{task.meta}</span>
                            </div>
                          </div>
                          <div className="task-status" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {task.status === 'completed' && (
                              <span className="status-badge status-completed">
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <CheckCircle2 size={14} /> Completed
                                </span>
                              </span>
                            )}
                            {task.status === 'progress' && (
                              <span className="status-badge status-progress">
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <CircleDashed size={14} /> In Progress
                                </span>
                              </span>
                            )}
                            {task.status === 'pending' && (
                              <span className="status-badge status-pending">Pending</span>
                            )}
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteTask(task.id);
                              }}
                              style={{ 
                                background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
                                padding: '0.25rem', borderRadius: '4px', display: 'flex'
                              }}
                              onMouseOver={(e) => e.currentTarget.style.color = '#ef4444'}
                              onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                              title="Delete task"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    <form onSubmit={addTask} style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', padding: '0 0.5rem' }}>
                      <input 
                        type="text" 
                        value={newTaskTitle}
                        onChange={(e) => setNewTaskTitle(e.target.value)}
                        placeholder="Add a new custom task..." 
                        style={{ 
                          flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', 
                          borderRadius: '8px', padding: '0.75rem 1rem', color: 'var(--text-main)', outline: 'none'
                        }}
                      />
                      <button type="submit" disabled={!newTaskTitle.trim()} className="btn btn-primary" style={{ padding: '0.75rem' }}>
                        <PlusCircle size={20} />
                      </button>
                    </form>
                  </div>
                )}
              </section>
            </main>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
            Select or add a project from the sidebar to get started.
          </div>
        )}
      </div>

      {showAddServer && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="glass-card" style={{ width: '400px', maxWidth: '90vw' }}>
            <h2 style={{ marginBottom: '1.5rem' }}>Add Remote Server</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label className="info-label">Name</label>
                <input 
                  type="text" 
                  value={newServer.name}
                  onChange={e => setNewServer({...newServer, name: e.target.value})}
                  className="config-input" 
                  placeholder="Production Server"
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '0.5rem', color: 'white' }}
                />
              </div>
              <div>
                <label className="info-label">Host (IP or Domain)</label>
                <input 
                  type="text" 
                  value={newServer.host}
                  onChange={e => setNewServer({...newServer, host: e.target.value})}
                  className="config-input" 
                  placeholder="192.168.1.100"
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '0.5rem', color: 'white' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: '1rem' }}>
                <div>
                  <label className="info-label">Username</label>
                  <input 
                    type="text" 
                    value={newServer.username}
                    onChange={e => setNewServer({...newServer, username: e.target.value})}
                    className="config-input" 
                    placeholder="root"
                    style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '0.5rem', color: 'white' }}
                  />
                </div>
                <div>
                  <label className="info-label">Port</label>
                  <input 
                    type="number" 
                    value={newServer.port}
                    onChange={e => setNewServer({...newServer, port: parseInt(e.target.value)})}
                    className="config-input" 
                    placeholder="22"
                    style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '0.5rem', color: 'white' }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button className="btn-secondary" style={{ flex: 1, padding: '0.5rem' }} onClick={() => setShowAddServer(false)}>Cancel</button>
                <button className="btn-primary" style={{ flex: 1, padding: '0.5rem' }} onClick={handleAddServer}>Add Server</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;
