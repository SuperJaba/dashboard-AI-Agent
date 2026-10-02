import { startTransition, useState, useEffect } from 'react';
import { 
  Folder, Plus, TerminalSquare, GitBranch, 
  Clock, Activity, ChevronDown, ChevronUp, Rocket, Save, CheckCircle2,
  Trash2, PlusCircle, LayoutDashboard, CircleDashed, Bot, LogOut, Key, Eye, EyeOff, Settings, X,
  RefreshCw, Circle, CheckCheck, Archive, RotateCcw, DownloadCloud, Laptop, WifiOff
} from 'lucide-react';
import './index.css';
import { TerminalView } from './TerminalView';
import { LocalWorkerModal } from './LocalWorkerModal';
import { AnalyticsPanel } from './AnalyticsPanel';
import { LlmServerManager } from './LlmServerManager';

import { ServerStats } from './ServerStats';
import { RepoStatus } from './RepoStatus';
import CustomWidgets from './CustomWidgets';

import { AgentsView } from './AgentsView';
import { FolderPickerDialog } from './FolderPickerDialog';
import { WebhookSettingsModal } from './components/WebhookSettingsModal';
import { KpiDashboardPanel } from './components/kpi/KpiDashboardPanel';
import { ModelRoutingWidget } from './components/ModelRoutingWidget';
import { useLiveTelemetry } from './hooks/useLiveTelemetry';

import { useDashboardState } from './hooks/useDashboardState';
import { DashboardTiles } from './TilesView';
import { usePreferences, type Language } from './preferences/PreferencesContext';

function App() {
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [cloneRepoUrl, setCloneRepoUrl] = useState('');
  const [cloneTargetDir, setCloneTargetDir] = useState('');
  const [cloneProjectName, setCloneProjectName] = useState('');
  const [cloneLoading, setCloneLoading] = useState(false);
  const [cloneError, setCloneError] = useState<string | null>(null);

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
    hideCompleted, setHideCompleted,
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
    toggleTaskStatus,
    syncProjectTasks,
    clearCompletedTasks,
    archiveTasks,
    restoreTask,
    markTasksCompleted,
    initGit,
    handleAddServer,
    deleteServer,
    handleAddProject,
    showFolderPicker,
    setShowFolderPicker,
    handleFolderPicked,
    handleProjectFolderSelected,
    projectFolderInputRef,
    handleCloneProject,
    setupSshKey,
    agents
  } = useDashboardState();
  const token = localStorage.getItem('dashboard_token') || localStorage.getItem('token') || '';
  const { theme, setTheme, language, setLanguage, t } = usePreferences();
  const [showSettings, setShowSettings] = useState(false);
  const [showWorkerModal, setShowWorkerModal] = useState(false);
  const [workersCount, setWorkersCount] = useState(0);
  const [showArchived, setShowArchived] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const { connected: isSseConnected } = useLiveTelemetry();

  useEffect(() => {
    let isMounted = true;
    const fetchWorkers = () => {
      const activeToken = token || localStorage.getItem('dashboard_token');
      fetch('/api/agents/workers', {
        headers: activeToken ? { Authorization: `Bearer ${activeToken}` } : {}
      })
        .then(res => res.ok ? res.json() : [])
        .then(data => {
          if (isMounted) setWorkersCount(Array.isArray(data) ? data.length : 0);
        })
        .catch(() => {
          if (isMounted) setWorkersCount(0);
        });
    };
    fetchWorkers();
    const interval = setInterval(fetchWorkers, 4000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [token]);

  // Dropdown-based agent selection for the "Local workspace" project view,
  // replacing what used to be a growing row of "Deploy <Agent>" buttons.
  const [selectedAgentName, setSelectedAgentName] = useState('');
  const installedAgents = agents.filter((a: any) => a.installed);
  const activeAgentName = selectedAgentName && installedAgents.some((a: any) => a.name.toLowerCase() === selectedAgentName)
    ? selectedAgentName
    : (installedAgents[0]?.name.toLowerCase() || '');

  const allProjectTasks = activeProject?.tasks || [];
  const activeTasks = allProjectTasks.filter((t: any) => t.status !== 'archived');
  const archivedTasks = allProjectTasks.filter((t: any) => t.status === 'archived');
  const completedTasks = activeTasks.filter((t: any) => t.status === 'completed');
  const pendingTasks = activeTasks.filter((t: any) => t.status !== 'completed');
  const selectedCompletedCount = selectedTaskIds.filter(id => completedTasks.some((t: any) => t.id === id)).length;

  return (
    <div className="layout">
      {/* Sidebar */}
      <aside className="sidebar">
        {/* Navigation Section */}
        <nav aria-label="Main Navigation" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '2rem' }}>
          <button 
            type="button"
            className={`project-item ${activeView === 'dashboard' && activeProjectId === null ? 'active' : ''}`}
            onClick={() => startTransition(() => {
              setActiveView('dashboard');
              setActiveProjectId(null);
            })}
            aria-current={activeView === 'dashboard' && activeProjectId === null ? 'page' : undefined}
          >
            <LayoutDashboard size={18} aria-hidden="true" />
            <span>Dashboard</span>
          </button>
          <button 
            type="button"
            className={`project-item ${activeView === 'agents' ? 'active' : ''}`}
            onClick={() => startTransition(() => setActiveView('agents'))}
            aria-current={activeView === 'agents' ? 'page' : undefined}
          >
            <Bot size={18} aria-hidden="true" />
            <span>Agenci AI</span>
          </button>
          <button 
            type="button"
            className="project-item"
            onClick={() => setShowWorkerModal(true)}
            title="Komenda połączenia i aktualny token do Socket.IO"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Laptop size={18} aria-hidden="true" color={workersCount > 0 ? '#10b981' : '#38bdf8'} />
              <span>{t('sidebar.socketTunnel')}</span>
            </div>
            <span style={{
              fontSize: '0.7rem',
              padding: '2px 6px',
              borderRadius: '4px',
              background: workersCount > 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(148, 163, 184, 0.15)',
              color: workersCount > 0 ? '#34d399' : '#94a3b8',
              fontWeight: 600
            }}>
              {workersCount > 0 ? '● Online' : 'Offline'}
            </span>
          </button>
        </nav>

        {/* Workspaces Section */}
        <button 
          type="button"
          className="sidebar-title-btn sidebar-title" 
          onClick={() => setIsWorkspacesExpanded(!isWorkspacesExpanded)}
          aria-expanded={isWorkspacesExpanded}
          aria-controls="workspaces-list"
          style={{ userSelect: 'none' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <LayoutDashboard size={20} aria-hidden="true" />
            <span>Workspaces</span>
          </div>
          {isWorkspacesExpanded ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
        </button>
        
        {isWorkspacesExpanded && (
          <div id="workspaces-list" className="projects-list">
            {projects.map(proj => (
              <div
                key={proj.id}
                className={`project-item ${activeProjectId === proj.id ? 'active' : ''}`}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'space-between' }}
              >
                <button
                  type="button"
                  onClick={() => setActiveProjectId(proj.id)}
                  style={{ flex: 1, textAlign: 'left' }}
                >
                  <Folder size={18} aria-hidden="true" />
                  <span>{proj.name.split(/[/\\]/).filter(Boolean).pop() || proj.name}</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Czy na pewno chcesz usunąć projekt "${proj.name.split(/[/\\]/).filter(Boolean).pop() || proj.name}"?`)) {
                      handleAddProject(proj.id, 'delete');
                    }
                  }}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px 4px' }}
                  aria-label={`Usuń projekt ${proj.name.split(/[/\\]/).filter(Boolean).pop() || proj.name}`}
                  title="Usuń projekt"
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </div>
            ))}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', marginTop: '0.5rem' }}>
              <button className="btn-add-project" aria-label="Add Project" style={{ justifyContent: 'center', padding: '0.4rem 0.2rem', fontSize: '0.8rem' }} onClick={handleAddProject} title="Add existing local project folder">
                <Plus size={16} aria-hidden="true" />
                Add Local
              </button>
              <button className="btn-add-project" aria-label="Clone Git" style={{ justifyContent: 'center', padding: '0.4rem 0.2rem', fontSize: '0.8rem', borderColor: 'rgba(56, 189, 248, 0.3)', color: '#38bdf8' }} onClick={() => { setShowCloneModal(true); setCloneError(null); }} title="Clone Git repository">
                <DownloadCloud size={16} aria-hidden="true" />
                Clone Git
              </button>
            </div>
            {/* Hidden native browser folder picker (webkitdirectory). We only get a
                folder name back (browsers never expose absolute paths), so the user
                confirms/completes the full path in a follow-up prompt. */}
            <input
              type="file"
              ref={projectFolderInputRef}
              // @ts-expect-error non-standard attributes not in React's typings
              webkitdirectory=""
              directory=""
              multiple
              style={{ display: 'none' }}
              onChange={handleProjectFolderSelected}
            />
          </div>
        )}

        {/* Remote Servers Section */}
        <button 
          type="button"
          className="sidebar-title-btn sidebar-title" 
          onClick={() => setIsRemoteExpanded(!isRemoteExpanded)}
          aria-expanded={isRemoteExpanded}
          aria-controls="remote-servers-list"
          style={{ userSelect: 'none', marginTop: '1rem' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <TerminalSquare size={20} aria-hidden="true" />
            <span>Remote</span>
          </div>
          {isRemoteExpanded ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
        </button>
        
        {isRemoteExpanded && (
          <div id="remote-servers-list" className="projects-list">
            {servers.map(server => (
              <div 
                key={server.id} 
                className={`project-item ${activeProjectId === `server-${server.id}` ? 'active' : ''}`}
                onClick={() => setActiveProjectId(`server-${server.id}`)}
                style={{ justifyContent: 'space-between' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Activity size={18} aria-hidden="true" />
                  <span>{server.name}</span>
                </div>
                <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setupSshKey(server.id).then(() => {return ''});
                    }}
                    style={{ background: 'none', border: 'none', color: '#10B981', cursor: 'pointer', padding: '2px 3px', borderRadius: '4px', marginRight: '4px' }}
                    aria-label={`Skonfiguruj klucz SSH dla serwera ${server.name}`}
                    onMouseOver={(e) => e.currentTarget.style.color = 'var(--primary)'}
                    onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                  >
                    <Key size={13} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => deleteServer(server.id, e)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px 3px', borderRadius: '4px' }}
                    title="Usuń serwer"
                    aria-label={`Usuń serwer ${server.name}`}
                  >
                    <Trash2 size={13} aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
            <button className="btn-add-project" onClick={() => setShowAddServer(true)}>
              <Plus size={18} aria-hidden="true" />
              Add Server
            </button>
          </div>
        )}

        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <label htmlFor="custom-llm-name" className="info-label" style={{ fontSize: '0.7rem', marginBottom: '0' }}>Nazwa Serwera</label>
          <input 
            id="custom-llm-name"
            type="text" 
            placeholder="np. AtomicChat" 
            value={customLlmName}
            onChange={(e) => setCustomLlmName(e.target.value)}
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '0.4rem', color: 'white', fontSize: '0.8rem' }}
          />
          <label htmlFor="custom-llm-url" className="info-label" style={{ fontSize: '0.7rem', marginBottom: '0', marginTop: '0.2rem' }}>Lokalny Serwer API</label>
          <input 
            id="custom-llm-url"
            type="text" 
            placeholder="http://localhost:1337/v1" 
            value={customLlmUrl}
            onChange={(e) => setCustomLlmUrl(e.target.value)}
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '0.4rem', color: 'white', fontFamily: 'var(--mono)', fontSize: '0.8rem' }}
          />
          <label htmlFor="custom-llm-model" className="info-label" style={{ fontSize: '0.7rem', marginBottom: '0', marginTop: '0.2rem' }}>Model bazowy</label>
          <input 
            id="custom-llm-model"
            type="text" 
            placeholder="np. AtomicChat/qwen35-4b-Q8_0" 
            value={customLlmModel}
            onChange={(e) => setCustomLlmModel(e.target.value)}
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '0.4rem', color: 'white', fontFamily: 'var(--mono)', fontSize: '0.8rem' }}
          />
          <label htmlFor="custom-api-key" className="info-label" style={{ fontSize: '0.7rem', marginBottom: '0', marginTop: '0.2rem' }}>API Key (Opcjonalny)</label>
          <input 
            id="custom-api-key"
            type="password" 
            placeholder="Brak" 
            value={customApiKey}
            onChange={(e) => setCustomApiKey(e.target.value)}
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '0.4rem', color: 'white', fontFamily: 'var(--mono)', fontSize: '0.8rem' }}
          />
          <button 
            type="button"
            onClick={saveSettings}
            aria-live="polite"
            style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'center', background: settingsSaved ? '#10B981' : 'var(--primary)', border: 'none', padding: '0.5rem', borderRadius: '8px', color: 'white', cursor: 'pointer', marginTop: '0.4rem', fontSize: '0.8rem', fontWeight: 'bold', transition: '0.3s' }}
          >
            {settingsSaved ? <CheckCircle2 size={15} aria-hidden="true" /> : <Save size={15} aria-hidden="true" />}
            {settingsSaved ? 'Saved to DB!' : 'Zapisz Serwer'}
          </button>
          <button 
            type="button"
            onClick={() => setShowWorkerModal(true)}
            title="Pobierz komendę i token Socket.IO dla Local Workera"
            style={{ 
              display: 'flex', 
              gap: '0.5rem', 
              alignItems: 'center', 
              justifyContent: 'center', 
              background: workersCount > 0 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(56, 189, 248, 0.1)', 
              border: `1px solid ${workersCount > 0 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(56, 189, 248, 0.25)'}`, 
              padding: '0.5rem', 
              borderRadius: '8px', 
              color: workersCount > 0 ? '#34d399' : '#38bdf8', 
              cursor: 'pointer', 
              marginTop: '0.5rem', 
              fontSize: '0.8rem', 
              fontWeight: 'bold', 
              transition: '0.3s' 
            }}
          >
            <Laptop size={16} aria-hidden="true" />
            <span>{workersCount > 0 ? `Socket: Połączono (${workersCount})` : 'Socket / Tunel PC'}</span>
          </button>
          <button 
            type="button"
            onClick={() => setShowSettings(true)}
            aria-label={t('settings.title')}
            title={t('settings.title')}
            style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', padding: '0.5rem', borderRadius: '8px', color: 'var(--text-muted)', cursor: 'pointer', marginTop: '0.5rem', transition: '0.3s' }}
          >
            <Settings size={16} aria-hidden="true" />
            {t('settings.title')}
          </button>
          <button 
            type="button"
            onClick={() => {
              localStorage.removeItem('dashboard_token');
              window.location.reload();
            }}
            style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'center', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '0.5rem', borderRadius: '8px', color: '#f87171', cursor: 'pointer', marginTop: '0.5rem', transition: '0.3s' }}
            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'}
            onMouseOut={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
          >
            <LogOut size={16} aria-hidden="true" />
            {t('sidebar.signOut')}
          </button>
        </div>
      </aside>

      {showSettings && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={t('settings.title')}
          onClick={() => setShowSettings(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--glass-border)', boxShadow: 'var(--glass-shadow)', borderRadius: '12px', padding: '1.5rem', width: '320px', maxWidth: '90vw', display: 'flex', flexDirection: 'column', gap: '1rem' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: '1.1rem', margin: 0 }}>{t('settings.title')}</h2>
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                aria-label={t('settings.close')}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label className="info-label" style={{ fontSize: '0.8rem' }}>{t('settings.theme')}</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setTheme('dark')}
                  aria-pressed={theme === 'dark'}
                  style={{ flex: 1, padding: '0.5rem', borderRadius: '8px', border: theme === 'dark' ? '1px solid var(--primary)' : '1px solid var(--glass-border)', background: theme === 'dark' ? 'var(--primary)' : 'rgba(255,255,255,0.05)', color: 'white', cursor: 'pointer' }}
                >
                  {t('settings.theme.dark')}
                </button>
                <button
                  type="button"
                  onClick={() => setTheme('light')}
                  aria-pressed={theme === 'light'}
                  style={{ flex: 1, padding: '0.5rem', borderRadius: '8px', border: theme === 'light' ? '1px solid var(--primary)' : '1px solid var(--glass-border)', background: theme === 'light' ? 'var(--primary)' : 'rgba(255,255,255,0.05)', color: 'white', cursor: 'pointer' }}
                >
                  {t('settings.theme.light')}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label htmlFor="language-select" className="info-label" style={{ fontSize: '0.8rem' }}>{t('settings.language')}</label>
              <select
                id="language-select"
                value={language}
                onChange={(e) => setLanguage(e.target.value as Language)}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '0.5rem', color: 'white' }}
              >
                <option value="pl">Polski</option>
                <option value="en">English</option>
                <option value="hi">हिन्दी (Hindi)</option>
              </select>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid var(--glass-border)', margin: '0.25rem 0' }} />

            <WebhookSettingsModal token={token} />
          </div>
        </div>
      )}

      <LocalWorkerModal 
        isOpen={showWorkerModal} 
        onClose={() => setShowWorkerModal(false)} 
        token={token} 
      />

      {/* Main Area */}
      <main id="main-content" tabIndex={-1} className="dashboard-container">
        {activeView === 'agents' ? (
          <AgentsView />
        ) : (
          <div style={{ height: '100%', overflowY: 'auto' }}>
            <LlmServerManager />
            {activeServer ? (
              <>
            <header className="header animate-in delay-1" style={{ alignItems: 'flex-start' }}>
              <div>
                <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <TerminalSquare size={28} color="var(--primary)" aria-hidden="true" />
                  {activeServer.name}
                </h1>
                <p style={{ color: 'var(--text-muted)' }}>{activeServer.username}@{activeServer.host}:{activeServer.port}</p>
              </div>
            </header>
            
            <ServerStats serverId={activeServer.id} />
            
            <CustomWidgets 
              token={token!} 
              server={activeServer}
              onLaunchTerminal={setTerminalConfig} 
            />
            
            <div style={{ marginBottom: '2rem' }}>
              <div className="glass-card animate-in delay-2" style={{ maxWidth: '100%' }}>
                <span className="info-label" style={{ marginBottom: '1rem', display: 'block' }}>Agent Operations</span>
                
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                  <button 
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}
                    onClick={() => setRemotePrompt('Skopiuj wybrane pliki i foldery do określonej ścieżki na tym serwerze.')}
                  >
                    📂 Copy Files
                  </button>
                  <button 
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}
                    onClick={() => setRemotePrompt('Uruchom skrypt aktualizacji na tym serwerze i zaraportuj wyniki.')}
                  >
                    ⚡ Run Script
                  </button>
                  <button 
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}
                    onClick={() => setRemotePrompt('Przeanalizuj logi systemowe w poszukiwaniu błędów i przygotuj raport.')}
                  >
                    📋 Analyze Logs
                  </button>
                  <button 
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', background: 'rgba(236, 72, 153, 0.1)', color: '#ec4899', border: '1px solid rgba(236,72,153,0.2)' }}
                    onClick={() => setRemotePrompt('Użyj skilla grafana-dashboards, aby przygotować pliki konfiguracyjne. Następnie połącz się przez SSH z tym serwerem, zainstaluj Dockera (jeśli nie ma) i uruchom stos Prometheus + Grafana za pomocą docker-compose z wygenerowanymi dashboardami na porcie 3000.')}
                  >
                    🔥 Deploy Grafana Stack
                  </button>
                </div>

                <label htmlFor="remote-prompt-input" className="info-label" style={{ display: 'block', marginBottom: '0.5rem' }}>Polecenie dla Agenta</label>
                <textarea 
                  id="remote-prompt-input"
                  value={remotePrompt}
                  onChange={e => setRemotePrompt(e.target.value)}
                  placeholder="e.g., Check PHP logs for errors, update packages, or install Grafana..."
                  style={{ 
                    width: '100%', minHeight: '100px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', 
                    borderRadius: '6px', padding: '0.75rem', color: 'var(--text-main)', marginBottom: '1rem', resize: 'vertical'
                  }}
                />
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  {agents.length === 0 && (
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Brak wykrytych agentów. Zainstaluj agenta w zakładce Agenci AI.</span>
                  )}
                  {agents.filter(a => a.installed).map(agent => (
                    <button 
                      key={agent.id}
                      type="button"
                      className="btn btn-primary" 
                      onClick={() => deployRemoteAgent(agent.name.toLowerCase(), activeServer)}
                      disabled={deploying !== null || !remotePrompt.trim()}
                      style={{ 
                        opacity: (deploying === agent.name.toLowerCase() || !remotePrompt.trim()) ? 0.7 : 1,
                        background: agent.name.toLowerCase() === 'agy' ? 'linear-gradient(135deg, #10B981, #059669)' : undefined
                      }}
                    >
                      <Rocket size={18} aria-hidden="true" />
                      {deploying === agent.name.toLowerCase() ? 'Deploying...' : `Deploy ${agent.name}`}
                    </button>
                  ))}
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
              </>
            ) : activeProject ? (
          <>
            <header className="header animate-in delay-1" style={{ alignItems: 'flex-start' }}>
              <div>
                <h1>{activeProject.name.split(/[/\\]/).filter(Boolean).pop() || activeProject.name}</h1>
                <p style={{ color: 'var(--text-muted)' }}>{activeProject.desc}</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.75rem' }}>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  {agents.length === 0 ? (
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Brak wykrytych agentów.</span>
                  ) : (
                    <>
                      <label htmlFor="local-agent-select" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Agent:</label>
                      <select
                        id="local-agent-select"
                        value={activeAgentName}
                        onChange={(e) => setSelectedAgentName(e.target.value)}
                        style={{
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid var(--glass-border)',
                          borderRadius: '8px',
                          padding: '0.5rem 0.75rem',
                          color: 'var(--text-main)',
                          fontSize: '0.85rem'
                        }}
                      >
                        {agents.filter(a => a.installed).map(agent => (
                          <option key={agent.id} value={agent.name.toLowerCase()} style={{ background: 'var(--bg-color)' }}>
                            {agent.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => activeAgentName && deployAgent(activeAgentName)}
                        disabled={deploying !== null || !activeAgentName}
                        style={{
                          opacity: (deploying === activeAgentName || !activeAgentName) ? 0.7 : 1,
                          background: activeAgentName === 'agy' ? 'linear-gradient(135deg, #10B981, #059669)' : undefined
                        }}
                      >
                        <Rocket size={20} aria-hidden="true" />
                        {deploying === activeAgentName ? 'Deploying...' : 'Deploy'}
                      </button>
                    </>
                  )}
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

            <div>
              <AnalyticsPanel projects={projects} />
              <div className="grid-top" style={{ marginBottom: '2rem' }}>
                <div className="glass-card animate-in delay-2">
                  <span className="info-label">Implementation Status</span>
                  <div className="info-value">
                    <Activity size={24} color="var(--secondary)" aria-hidden="true" />
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
                      <TerminalSquare size={24} color="var(--primary)" aria-hidden="true" />
                      {activeProject.tech}
                    </div>
                  </div>
                  <button 
                    type="button"
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
                    <Folder size={20} color="#10B981" aria-hidden="true" />
                    {activeProject.path}
                  </div>
                  <div className="info-value" style={{ fontSize: '1rem', marginTop: '0.5rem' }}>
                    <GitBranch size={20} color="#F59E0B" aria-hidden="true" />
                    {activeProject.branch ? (
                      activeProject.branch
                    ) : (
                      <button type="button" className="btn-add-project" style={{ marginLeft: '0.5rem', padding: '0.2rem 0.6rem', fontSize: '0.75rem' }} onClick={initGit}>
                        Create Git
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <RepoStatus directory={activeProject.path || ''} onLaunchTerminal={(config) => setTerminalConfig(config)} />

              <section className="glass-card animate-in delay-3" style={{ maxWidth: '100%' }}>
                <div 
                  className="sidebar-title-btn tasks-header" 
                  onClick={() => setShowTasks(!showTasks)}
                  aria-expanded={showTasks}
                  aria-controls="tasks-list"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setShowTasks(!showTasks);
                    }
                  }}
                >
                  <h2 className="section-title">
                    <Clock size={24} color="var(--primary)" aria-hidden="true" />
                    Current Tasks ({pendingTasks.length} active{completedTasks.length > 0 ? ` / ${activeTasks.length} total` : ''})
                  </h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {showTasks && (
                      <>
                        <button 
                          type="button"
                          className="btn-add-project" 
                          style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem', zIndex: 2, display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                          onClick={async (e) => {
                            e.stopPropagation();
                            const res = await syncProjectTasks();
                            if (res && res.success) {
                              const msg = `Synced: ${res.updatedInWorkspace.length} in workspace, ${res.updatedInDb.length} in DB`;
                              setSyncNotice(msg);
                              setTimeout(() => setSyncNotice(null), 3500);
                            }
                          }}
                          title="Synchronizuj statusy zadań między plikami projektu a bazą danych"
                        >
                          <RefreshCw size={14} className={deploying === 'sync-tasks' ? 'spin' : ''} />
                          Sync Tasks
                        </button>
                        <button 
                          type="button"
                          className="btn-add-project" 
                          style={{ 
                            padding: '0.2rem 0.6rem', 
                            fontSize: '0.75rem', 
                            zIndex: 2, 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '0.3rem',
                            opacity: completedTasks.length === 0 ? 0.5 : 1,
                            cursor: completedTasks.length === 0 ? 'not-allowed' : 'pointer'
                          }}
                          disabled={completedTasks.length === 0}
                          onClick={(e) => {
                            e.stopPropagation();
                            archiveTasks();
                          }}
                          title={
                            completedTasks.length === 0
                              ? 'Brak zakończonych zadań do archiwizacji'
                              : selectedCompletedCount > 0
                              ? `Zarchiwizuj tylko zaznaczone ukończone zadania (${selectedCompletedCount})`
                              : `Zarchiwizuj wszystkie ukończone zadania (${completedTasks.length})`
                          }
                        >
                          <Archive size={14} />
                          {selectedCompletedCount > 0 ? `Archive (${selectedCompletedCount})` : 'Archive'}
                        </button>
                        {completedTasks.length > 0 && (
                          <button
                            type="button"
                            className="btn-add-project"
                            style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem', zIndex: 2, display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#f59e0b' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm('Czy na pewno chcesz usunąć ukończone zadania z tabeli projektu?')) {
                                clearCompletedTasks();
                              }
                            }}
                            title="Usuń zakończone zadania z tabelki"
                          >
                            <CheckCheck size={14} />
                            Clear Completed
                          </button>
                        )}
                        <button 
                          type="button"
                          className="btn-add-project" 
                          style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem', zIndex: 2, display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setHideCompleted(!hideCompleted);
                          }}
                          title={hideCompleted ? 'Pokaż zakończone zadania' : 'Ukryj zakończone zadania'}
                        >
                          {hideCompleted ? <Eye size={14} /> : <EyeOff size={14} />}
                          {hideCompleted ? 'Show Completed' : 'Hide Completed'}
                        </button>
                        <button 
                          type="button"
                          className="btn-add-project" 
                          style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem', zIndex: 2 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (selectedTaskIds.length === activeTasks.length && activeTasks.length > 0) {
                              setSelectedTaskIds([]);
                            } else {
                              setSelectedTaskIds(activeTasks.map((t: any) => t.id));
                            }
                          }}
                        >
                          {selectedTaskIds.length === activeTasks.length && activeTasks.length > 0 ? 'Uncheck All' : 'Check All'}
                        </button>
                        <button 
                          type="button"
                          className="btn-add-project" 
                          style={{ 
                            padding: '0.2rem 0.6rem', 
                            fontSize: '0.75rem', 
                            zIndex: 2, 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '0.3rem',
                            opacity: selectedTaskIds.length > 0 ? 1 : 0.6,
                            cursor: selectedTaskIds.length > 0 ? 'pointer' : 'not-allowed'
                          }}
                          disabled={selectedTaskIds.length === 0}
                          onClick={(e) => {
                            e.stopPropagation();
                            markTasksCompleted();
                          }}
                          title="Oznacz zaznaczone zadania jako ukończone"
                        >
                          <CheckCircle2 size={13} />
                          Mark Completed
                        </button>
                      </>
                    )}
                    {showTasks ? <ChevronUp size={24} color="var(--text-muted)" aria-hidden="true" /> : <ChevronDown size={24} color="var(--text-muted)" aria-hidden="true" />}
                  </div>
                </div>
                
                {showTasks && (
                  <div id="tasks-list" className="task-list animate-in">
                    {syncNotice && (
                      <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid #10b981', borderRadius: '6px', color: '#10b981', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <CheckCircle2 size={16} />
                        {syncNotice}
                      </div>
                    )}
                    {activeTasks
                      .filter((task: any) => !hideCompleted || task.status !== 'completed')
                      .map((task: any) => (
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
                              aria-label={`Select task: ${task.title}`}
                              onChange={() => {}}
                              style={{ 
                                width: '16px', 
                                height: '16px', 
                                accentColor: task.status === 'completed' ? '#f59e0b' : 'var(--primary)', 
                                cursor: 'pointer' 
                              }}
                            />
                            <div className="task-info">
                              <span className="task-title" style={{ textDecoration: task.status === 'completed' ? 'line-through' : 'none' }}>
                                {task.title}
                              </span>
                              <span className="task-meta">{task.meta}</span>
                            </div>
                          </div>
                          <div className="task-status" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleTaskStatus(task.id);
                              }}
                              className={`status-badge ${task.status === 'completed' ? 'status-completed' : (task.status === 'progress' ? 'status-progress' : 'status-pending')}`}
                              style={{
                                cursor: 'pointer',
                                border: 'none',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '0.25rem 0.65rem',
                                borderRadius: '6px',
                                transition: 'all 0.2s',
                                fontSize: '0.75rem',
                                background: task.status === 'completed' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.06)'
                              }}
                              title={task.status === 'completed' ? 'Kliknij, aby odznaczyć jako oczekujące (Pending)' : 'Kliknij, aby oznaczyć jako zakończone w bazie i workspace (Completed)'}
                              aria-label={`Przełącz status zadania: ${task.title}`}
                            >
                              {task.status === 'completed' ? (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <CheckCircle2 size={14} aria-hidden="true" /> Completed
                                </span>
                              ) : task.status === 'progress' ? (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <CircleDashed size={14} aria-hidden="true" /> In Progress
                                </span>
                              ) : (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <Circle size={14} style={{ opacity: 0.5 }} aria-hidden="true" /> Pending
                                </span>
                              )}
                            </button>
                            <button 
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteTask(task.id).then(() => {
                                  // Handle the result if needed
                                });
                              }}
                              aria-label={`Delete task ${task.title}`}
                              style={{ 
                                background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
                                padding: '0.25rem', borderRadius: '4px', display: 'flex'
                              }}
                              onMouseOver={(e) => e.currentTarget.style.color = '#ef4444'}
                              onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                              title="Delete task"
                            >
                              <Trash2 size={16} aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    <form onSubmit={addTask} style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', padding: '0 0.5rem' }}>
                      <input 
                        id="new-task-input"
                        type="text" 
                        value={newTaskTitle}
                        onChange={(e) => setNewTaskTitle(e.target.value)}
                        placeholder="Add a new custom task..." 
                        aria-label="Add a new custom task"
                        style={{ 
                          flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', 
                          borderRadius: '8px', padding: '0.75rem 1rem', color: 'var(--text-main)', outline: 'none'
                        }}
                      />
                      <button type="submit" disabled={!newTaskTitle.trim()} aria-label="Add task" className="btn btn-primary" style={{ padding: '0.75rem' }}>
                        <PlusCircle size={20} aria-hidden="true" />
                      </button>
                    </form>

                    {archivedTasks.length > 0 && (
                      <div style={{ marginTop: '1.25rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.06)', paddingLeft: '0.5rem', paddingRight: '0.5rem' }}>
                        <button
                          type="button"
                          onClick={() => setShowArchived(!showArchived)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            padding: '0.25rem 0'
                          }}
                          title="Pokaż lub ukryj zarchiwizowane zadania"
                        >
                          <Archive size={14} />
                          <span>{showArchived ? 'Hide Archived' : 'Show Archived'} ({archivedTasks.length})</span>
                          {showArchived ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>

                        {showArchived && (
                          <div className="task-list animate-in" style={{ marginTop: '0.5rem', opacity: 0.85 }}>
                            {archivedTasks.map((task: any) => (
                              <div
                                className="task-item"
                                key={task.id}
                                style={{
                                  background: 'rgba(255, 255, 255, 0.015)',
                                  border: '1px solid rgba(255, 255, 255, 0.04)',
                                  cursor: 'default'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <Archive size={16} color="var(--text-muted)" style={{ opacity: 0.6 }} />
                                    <div className="task-info">
                                      <span className="task-title" style={{ textDecoration: 'line-through', opacity: 0.7 }}>
                                        {task.title}
                                      </span>
                                      <span className="task-meta">{task.meta || 'Archived Task'}</span>
                                    </div>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <button
                                      type="button"
                                      onClick={() => restoreTask(task.id)}
                                      title="Przywróć zadanie do zakończonych (Restore)"
                                      aria-label={`Przywróć zadanie: ${task.title}`}
                                      className="btn-add-project"
                                      style={{
                                        padding: '0.2rem 0.5rem',
                                        fontSize: '0.75rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.3rem'
                                      }}
                                    >
                                      <RotateCcw size={13} />
                                      Restore
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => deleteTask(task.id)}
                                      aria-label={`Usuń trwale ${task.title}`}
                                      style={{
                                        background: 'none',
                                        border: 'none',
                                        color: 'var(--text-muted)',
                                        cursor: 'pointer',
                                        padding: '0.25rem',
                                        borderRadius: '4px',
                                        display: 'flex'
                                      }}
                                      onMouseOver={(e) => (e.currentTarget.style.color = '#ef4444')}
                                      onMouseOut={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                                      title="Delete permanently"
                                    >
                                      <Trash2 size={16} aria-hidden="true" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </section>
            </div>
          </>
        ) : (
          <div>
            <div style={{ padding: '1.25rem 1.25rem 0 1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <KpiDashboardPanel />
              <ModelRoutingWidget />
              <AnalyticsPanel projects={projects} />
            </div>
            <DashboardTiles projects={projects} onProjectClick={setActiveProjectId} onAddProject={handleAddProject} />
          </div>
        )}
          </div>
        )}
      </main>

      {showAddServer && (
        <div 
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-server-modal-title"
          onKeyDown={(e) => e.key === 'Escape' && setShowAddServer(false)}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
        >
          <div className="glass-card" style={{ width: '400px', maxWidth: '90vw' }}>
            <h2 id="add-server-modal-title" style={{ marginBottom: '1.5rem' }}>Add Remote Server</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label htmlFor="new-server-name" className="info-label">Name</label>
                <input 
                  id="new-server-name"
                  type="text" 
                  value={newServer.name}
                  onChange={e => setNewServer({...newServer, name: e.target.value})}
                  className="config-input" 
                  placeholder="Production Server"
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '0.5rem', color: 'white' }}
                />
              </div>
              <div>
                <label htmlFor="new-server-host" className="info-label">Host (IP or Domain)</label>
                <input 
                  id="new-server-host"
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
                  <label htmlFor="new-server-username" className="info-label">Username</label>
                  <input 
                    id="new-server-username"
                    type="text" 
                    value={newServer.username}
                    onChange={e => setNewServer({...newServer, username: e.target.value})}
                    className="config-input" 
                    placeholder="root"
                    style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '0.5rem', color: 'white' }}
                  />
                </div>
                <div>
                  <label htmlFor="new-server-port" className="info-label">Port</label>
                  <input 
                    id="new-server-port"
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
                <label htmlFor="new-server-ssh-password" className="info-label">
                  Hasło SSH&nbsp;<span style={{ color: '#6b7280', fontWeight: 400, fontSize: '0.75rem' }}>(opcjonalne — zamiast klucza)</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="new-server-ssh-password"
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
                    aria-label={showPassword ? 'Ukryj hasło SSH' : 'Pokaż hasło SSH'}
                  >
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button type="button" className="btn-secondary" style={{ flex: 1, padding: '0.5rem' }} onClick={() => setShowAddServer(false)}>Cancel</button>
                <button type="button" className="btn-primary" style={{ flex: 1, padding: '0.5rem' }} onClick={handleAddServer}>Add Server</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showFolderPicker && (
        <FolderPickerDialog
          isOpen={showFolderPicker}
          onClose={() => setShowFolderPicker(false)}
          onSelectFolder={handleFolderPicked}
        />
      )}

      {/* Clone Git Repository Modal */}
      {showCloneModal && (
        <div className="modal-overlay" onClick={() => !cloneLoading && setShowCloneModal(false)}>
          <div className="modal-content glass-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px', width: '100%', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
            <h3 className="section-title" style={{ color: '#38bdf8' }}>
              <DownloadCloud size={20} />
              Clone Git Repository
            </h3>

            {cloneError && (
              <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '1rem' }}>
                {cloneError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label htmlFor="clone-repo-url" className="info-label">Repository URL (HTTPS or SSH)</label>
                <input
                  id="clone-repo-url"
                  type="text"
                  value={cloneRepoUrl}
                  onChange={e => {
                    setCloneRepoUrl(e.target.value);
                    if (!cloneProjectName && e.target.value) {
                      const match = e.target.value.trim().match(/\/([^/]+?)(\.git)?$/);
                      if (match && match[1]) setCloneProjectName(match[1]);
                    }
                  }}
                  className="config-input"
                  placeholder="https://github.com/username/repository.git"
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '0.5rem', color: 'white' }}
                  autoFocus
                />
              </div>

              <div>
                <label htmlFor="clone-target-dir" className="info-label">Target Directory</label>
                <input
                  id="clone-target-dir"
                  type="text"
                  value={cloneTargetDir}
                  onChange={e => setCloneTargetDir(e.target.value)}
                  className="config-input"
                  placeholder="C:\Projects\my-repo or ~/projects/my-repo"
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '0.5rem', color: 'white' }}
                />
              </div>

              <div>
                <label htmlFor="clone-project-name" className="info-label">Project Name in Dashboard (optional)</label>
                <input
                  id="clone-project-name"
                  type="text"
                  value={cloneProjectName}
                  onChange={e => setCloneProjectName(e.target.value)}
                  className="config-input"
                  placeholder="My Repo"
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '0.5rem', color: 'white' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ flex: 1, padding: '0.5rem' }}
                  onClick={() => setShowCloneModal(false)}
                  disabled={cloneLoading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  style={{ flex: 1, padding: '0.5rem', background: 'linear-gradient(135deg, #0284c7, #0369a1)' }}
                  disabled={!cloneRepoUrl.trim() || !cloneTargetDir.trim() || cloneLoading}
                  onClick={async () => {
                    setCloneLoading(true);
                    setCloneError(null);
                    try {
                      await handleCloneProject(cloneRepoUrl.trim(), cloneTargetDir.trim(), cloneProjectName.trim() || undefined);
                      setShowCloneModal(false);
                      setCloneRepoUrl('');
                      setCloneTargetDir('');
                      setCloneProjectName('');
                    } catch (err: any) {
                      setCloneError(err.message || 'Failed to clone repository');
                    } finally {
                      setCloneLoading(false);
                    }
                  }}
                >
                  {cloneLoading ? 'Cloning...' : 'Clone Repository'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Offline banner (T2.3) */}
      {!isSseConnected && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(234, 179, 8, 0.15)',
            borderTop: '1px solid rgba(234, 179, 8, 0.3)',
            color: '#ca8a04',
            padding: '0.4rem 1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            fontSize: '0.8rem',
            fontWeight: 500,
            backdropFilter: 'blur(8px)',
          }}
        >
          <WifiOff size={14} aria-hidden="true" />
          <span>Brak połączenia z serwerem — ponawiam...</span>
        </div>
      )}

    </div>
  );
}

export default App;
