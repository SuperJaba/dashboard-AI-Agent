import { 
  Folder, Plus, TerminalSquare, GitBranch, 
  Clock, Activity, ChevronDown, ChevronUp, Rocket, Save, CheckCircle2,
  Trash2, PlusCircle, LayoutDashboard, CircleDashed, Bot, LogOut, Key
} from 'lucide-react';
import './index.css';
import { TerminalView } from './TerminalView';
import { AnalyticsPanel } from './AnalyticsPanel';

import { ServerStats } from './ServerStats';
import { RepoStatus } from './RepoStatus';
import CustomWidgets from './CustomWidgets';
import { AgentsView } from './AgentsView';

import { useDashboardState } from './hooks/useDashboardState';
import { DashboardTiles } from './TilesView';

function App() {
  const {
    activeView, setActiveView,
    projects,
    activeProjectId, setActiveProjectId,
    servers,
    showAddServer, setShowAddServer,
    newServer, setNewServer,
    showPassword, setShowPassword,
    remotePrompt, setRemotePrompt,
    isWorkspacesExpanded, setIsWorkspacesExpanded,
    isRemoteExpanded, setIsRemoteExpanded,
    showTasks, setShowTasks,
    useBrowserTerminal,
    terminalConfig, setTerminalConfig,
    selectedTaskIds, setSelectedTaskIds,
    deploying,
    customLlmUrl, setCustomLlmUrl,
    customApiKey, setCustomApiKey,
    customLlmName, setCustomLlmName,
    customLlmModel, setCustomLlmModel,
    settingsSaved,
    newTaskTitle, setNewTaskTitle,
    activeProject,
    activeServer,
    saveSettings,
    handleTerminalToggle,
    deployAgent,
    deployRemoteAgent,
    analyzeProject,
    addTask,
    deleteTask,
    initGit,
    handleAddServer,
    deleteServer,
    handleAddProject,
    setupSshKey
  } = useDashboardState();
  const token = localStorage.getItem('token') || '';
  return (
    <div className="layout">
      {/* Sidebar */}
      <aside className="sidebar">
        {/* Navigation Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '2rem' }}>
          <div 
            className={`project-item ${activeView === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveView('dashboard')}
          >
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </div>
          <div 
            className={`project-item ${activeView === 'agents' ? 'active' : ''}`}
            onClick={() => setActiveView('agents')}
          >
            <Bot size={18} />
            <span>Agenci AI</span>
          </div>
        </div>

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
                <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setupSshKey(server.id);
                    }}
                    style={{ background: 'none', border: 'none', color: '#10B981', cursor: 'pointer', padding: '2px 3px', borderRadius: '4px', marginRight: '4px' }}
                    title="Skonfiguruj klucz SSH dla Agenta"
                    onMouseOver={(e) => e.currentTarget.style.color = '#34D399'}
                    onMouseOut={(e) => e.currentTarget.style.color = '#10B981'}
                  >
                    <Key size={13} />
                  </button>
                  <button
                    onClick={(e) => deleteServer(server.id, e)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px 3px', borderRadius: '4px' }}
                    title="Usuń serwer"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
            <button className="btn-add-project" onClick={() => setShowAddServer(true)}>
              <Plus size={18} />
              Add Server
            </button>
          </div>
        )}

        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <span className="info-label" style={{ fontSize: '0.7rem', marginBottom: '0' }}>Nazwa Serwera</span>
          <input 
            type="text" 
            placeholder="np. AtomicChat" 
            value={customLlmName}
            onChange={(e) => setCustomLlmName(e.target.value)}
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '0.4rem', color: 'white', fontSize: '0.8rem' }}
          />
          <span className="info-label" style={{ fontSize: '0.7rem', marginBottom: '0', marginTop: '0.2rem' }}>Lokalny Serwer API</span>
          <input 
            type="text" 
            placeholder="http://localhost:1337/v1" 
            value={customLlmUrl}
            onChange={(e) => setCustomLlmUrl(e.target.value)}
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '0.4rem', color: 'white', fontFamily: 'var(--mono)', fontSize: '0.8rem' }}
          />
          <span className="info-label" style={{ fontSize: '0.7rem', marginBottom: '0', marginTop: '0.2rem' }}>Model bazowy</span>
          <input 
            type="text" 
            placeholder="np. AtomicChat/qwen35-4b-Q8_0" 
            value={customLlmModel}
            onChange={(e) => setCustomLlmModel(e.target.value)}
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '0.4rem', color: 'white', fontFamily: 'var(--mono)', fontSize: '0.8rem' }}
          />
          <span className="info-label" style={{ fontSize: '0.7rem', marginBottom: '0', marginTop: '0.2rem' }}>API Key (Opcjonalny)</span>
          <input 
            type="password" 
            placeholder="Brak" 
            value={customApiKey}
            onChange={(e) => setCustomApiKey(e.target.value)}
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '0.4rem', color: 'white', fontFamily: 'var(--mono)', fontSize: '0.8rem' }}
          />
          <button 
            onClick={saveSettings}
            style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'center', background: settingsSaved ? '#10B981' : 'var(--primary)', border: 'none', padding: '0.5rem', borderRadius: '8px', color: 'white', cursor: 'pointer', marginTop: '0.4rem', fontSize: '0.8rem', fontWeight: 'bold', transition: '0.3s' }}
          >
            {settingsSaved ? <CheckCircle2 size={15} /> : <Save size={15} />}
            {settingsSaved ? 'Saved to DB!' : 'Zapisz Serwer'}
          </button>
          <button 
            onClick={() => {
              localStorage.removeItem('dashboard_token');
              window.location.reload();
            }}
            style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'center', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '0.5rem', borderRadius: '8px', color: '#f87171', cursor: 'pointer', marginTop: '0.5rem', transition: '0.3s' }}
            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'}
            onMouseOut={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Area */}
      <div className="dashboard-container">
        {activeView === 'agents' ? (
          <AgentsView />
        ) : activeServer ? (
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
            
            <ServerStats serverId={activeServer.id} />
            
            <CustomWidgets token={token!} />
            
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
              </div>
            </div>
            {terminalConfig && (
              <div style={{ marginBottom: '2rem' }}>
                <TerminalView
                  config={terminalConfig}
                  onClose={() => setTerminalConfig(null)}
                />
              </div>
            )}
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
              </div>
            </header>

            {terminalConfig && (
              <div style={{ marginBottom: '2rem' }}>
                <TerminalView
                  config={terminalConfig}
                  onClose={() => setTerminalConfig(null)}
                />
              </div>
            )}

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

              <RepoStatus directory={activeProject.path} onLaunchTerminal={(config) => setTerminalConfig(config)} />

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
          <DashboardTiles projects={projects} onProjectClick={setActiveProjectId} />
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
              {/* MyDevil toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                <input
                  id="use_devil_toggle"
                  type="checkbox"
                  checked={newServer.use_devil}
                  onChange={e => setNewServer({...newServer, use_devil: e.target.checked})}
                  style={{ width: '1rem', height: '1rem', accentColor: '#34d399', cursor: 'pointer' }}
                />
                <label htmlFor="use_devil_toggle" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                  <span style={{ color: 'white', fontSize: '0.875rem', fontWeight: 500 }}>MyDevil.net hosting (devil CLI)</span>
                  <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>Używa <code style={{ color: '#34d399' }}>devil www list</code> zamiast <code style={{ color: '#9ca3af' }}>ps aux</code></span>
                </label>
              </div>
              {/* Hasło SSH */}
              <div>
                <label className="info-label">
                  Hasło SSH&nbsp;<span style={{ color: '#6b7280', fontWeight: 400, fontSize: '0.75rem' }}>(opcjonalne — zamiast klucza)</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newServer.ssh_password}
                    onChange={e => setNewServer({...newServer, ssh_password: e.target.value})}
                    className="config-input"
                    placeholder="Zostaw puste jeśli używasz klucza SSH"
                    style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '0.5rem 2.75rem 0.5rem 0.5rem', color: 'white', boxSizing: 'border-box' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(p => !p)}
                    style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: '0.2rem 0.3rem', lineHeight: 1 }}
                    title={showPassword ? 'Ukryj hasło' : 'Pokaż hasło'}
                  >
                    {showPassword ? '🙈' : '👁️'}
                  </button>
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
