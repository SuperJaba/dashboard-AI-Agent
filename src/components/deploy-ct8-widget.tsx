import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  Rocket, CheckCircle2, AlertCircle, RefreshCw, Terminal, Clock, 
  ExternalLink, X, ShieldAlert, Copy, Check, Search, Server, OctagonX, Package, FolderGit2
} from 'lucide-react';
import { apiClient } from '../shared/api-client';
import { cleanLogLine } from '../shared/clean-logs';
import { useDashboardSocket } from '../hooks/useDashboardSocket';

interface ProjectItem {
  id: number;
  name: string;
  path: string;
  desc?: string;
}

export interface DeployApp {
  id: string;
  name: string;
  domain: string;
  localPath?: string;
  healthUrl?: string;
  deployScript?: string;
  default?: boolean;
}

interface DeployStatus {
  state: 'IDLE' | 'RUNNING' | 'SUCCESS' | 'FAILED';
  isDeploying: boolean;
  currentStep: string;
  startTime: string | null;
  logs: { timestamp: string; text: string; target?: string }[];
  lastDeploy: {
    status: string;
    timestamp: string | null;
    durationSeconds: number;
    targetHost: string;
    error: string | null;
    activeTargets?: string[];
    app?: string;
  };
  targetHost: string;
  selectedApp?: string;
  activeTargets?: string[];
  targetStates?: Record<string, { state: string; currentStep: string; logs: { timestamp: string; text: string; target?: string }[] }>;
}

interface DeployHealth {
  healthy: boolean;
  statusCode: number;
  latencyMs: number;
  timestamp: string;
  error?: string;
  app?: string;
}

export interface DeployTarget {
  id: string;
  name: string;
  host: string;
  type: string;
  default?: boolean;
}

interface DeployCt8WidgetProps {
  className?: string;
  onDeployStateChange?: (isDeploying: boolean) => void;
}

const DEFAULT_APPS: DeployApp[] = [
  {
    id: 'dashboard',
    name: 'Dashboard (Command Center)',
    domain: 'dashboard.jagger2.ct8.pl',
    healthUrl: 'https://dashboard.jagger2.ct8.pl/health',
    deployScript: 'scripts/deploy-ct8-optimized.sh',
    default: true,
  },
  {
    id: 'invoice-splitter',
    name: 'Invoice Splitter',
    domain: 'invoice-server.jagger2.ct8.pl',
    healthUrl: 'https://invoice-server.jagger2.ct8.pl/health',
    deployScript: 'scripts/deploy-ct8-optimized.sh',
    default: false,
  },
];

const DEFAULT_TARGETS: DeployTarget[] = [
  {
    id: 'ct8',
    name: 'CT8.pl Production',
    host: 'dashboard.jagger2.ct8.pl',
    type: 'ct8',
    default: true,
  },
  {
    id: 'omv',
    name: 'OMV (Home Server)',
    host: '10.10.10.100',
    type: 'omv',
    default: false,
  },
];

export const DeployCt8Widget: React.FC<DeployCt8WidgetProps> = ({ className = '', onDeployStateChange }) => {
  const [appsList, setAppsList] = useState<DeployApp[]>(DEFAULT_APPS);
  const [selectedApp, setSelectedApp] = useState<string>(() => {
    try {
      return localStorage.getItem('dashboard_last_deploy_app') || 'dashboard';
    } catch {
      return 'dashboard';
    }
  });
  const [status, setStatus] = useState<DeployStatus | null>(null);
  const [health, setHealth] = useState<DeployHealth | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [showLogsModal, setShowLogsModal] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedLogs, setCopiedLogs] = useState<boolean>(false);
  const [copiedRestartCmd, setCopiedRestartCmd] = useState<boolean>(false);
  const [logFilter, setLogFilter] = useState<string>('');
  const [showWorkspaceModal, setShowWorkspaceModal] = useState<boolean>(false);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectItem | null>(null);
  const [customPath, setCustomPath] = useState<string>('');
  const [targetServer, setTargetServer] = useState<string>('dashboard.jagger2.ct8.pl');
  const [deployEnv, setDeployEnv] = useState<string>('production');
  const [targetsList, setTargetsList] = useState<DeployTarget[]>(DEFAULT_TARGETS);
  const [selectedTargets, setSelectedTargets] = useState<string[]>(['ct8']);
  const [activeLogTab, setActiveLogTab] = useState<string>('all');
  const [killingRemote, setKillingRemote] = useState<boolean>(false);
  const [abortingDeploy, setAbortingDeploy] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const logsEndRef = useRef<HTMLDivElement>(null);

  // Hook do nasłuchiwania WebSocket z /dashboard
  const { socket } = useDashboardSocket();

  const activeApp = useMemo(() => {
    return appsList.find((a) => a.id === selectedApp) || appsList[0] || DEFAULT_APPS[0];
  }, [appsList, selectedApp]);

  const currentRestartCmd = useMemo(() => {
    return `ssh jagger2 "touch ~/domains/${activeApp.domain}/tmp/restart.txt && devil www restart ${activeApp.domain}"`;
  }, [activeApp.domain]);

  const fetchApps = useCallback(async () => {
    try {
      const data = await apiClient.get<DeployApp[]>('/api/deploy/apps');
      if (Array.isArray(data) && data.length > 0) {
        setAppsList(data);
      }
    } catch {
      // Use fallback DEFAULT_APPS
    }
  }, []);

  const fetchTargets = useCallback(async () => {
    try {
      const data = await apiClient.get<DeployTarget[]>('/api/deploy/targets');
      if (Array.isArray(data) && data.length > 0) {
        setTargetsList(data);
      }
    } catch {
      // Use fallback DEFAULT_TARGETS
    }
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await apiClient.get<DeployStatus>('/api/deploy/status');
      setStatus(data);
    } catch (err: any) {
      console.error('Błąd pobierania statusu wdrożenia:', err);
    }
  }, []);

  const fetchHealth = useCallback(async (appId?: string) => {
    const targetApp = appId || selectedApp;
    try {
      const data = await apiClient.get<DeployHealth>(`/api/deploy/health?app=${encodeURIComponent(targetApp)}`);
      setHealth(data);
    } catch (err: any) {
      console.error('Błąd pobierania healthchecku CT8:', err);
    }
  }, [selectedApp]);

  const fetchProjects = useCallback(async () => {
    try {
      const data = await apiClient.get<ProjectItem[]>('/api/projects');
      if (Array.isArray(data)) {
        setProjects(data);
        setSelectedProject((prev) => {
          if (!prev && data.length > 0) {
            return data.find((p) => p.name !== 'dashboard') || data[0];
          }
          return prev;
        });
      }
    } catch (err) {
      console.error('Błąd pobierania projektów workspace:', err);
    }
  }, []);

  const handleSelectApp = (appId: string) => {
    setSelectedApp(appId);
    try {
      localStorage.setItem('dashboard_last_deploy_app', appId);
    } catch {
      // ignore
    }
    fetchHealth(appId);
  };

  const refreshAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchApps(), fetchTargets(), fetchStatus(), fetchHealth(selectedApp), fetchProjects()]);
    setLoading(false);
  }, [fetchApps, fetchTargets, fetchStatus, fetchHealth, selectedApp, fetchProjects]);

  useEffect(() => {
    refreshAll();
    const interval = setInterval(() => {
      fetchHealth(selectedApp);
    }, 15000);
    return () => clearInterval(interval);
  }, [refreshAll, fetchHealth, selectedApp]);

  // Notyfikuj komponent nadrzędny o stanie wdrażania
  useEffect(() => {
    onDeployStateChange?.(status?.isDeploying || false);
  }, [status?.isDeploying, onDeployStateChange]);

  // Nasłuchiwanie Socket.IO na zdarzenia deploy
  useEffect(() => {
    if (!socket) return;

    const handleDeployLog = (logEntry: { timestamp: string; text: string; target?: string }) => {
      const cleaned = cleanLogLine(logEntry.text);
      if (!cleaned) return;

      setStatus((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          logs: [...prev.logs.slice(-250), { ...logEntry, text: cleaned }],
        };
      });
    };

    const handleDeployStatus = (updatedStatus: DeployStatus) => {
      setStatus(updatedStatus);
      if (updatedStatus.isDeploying) {
        setShowLogsModal(true);
      }
    };

    const handleDeployFinished = () => {
      fetchHealth();
      fetchStatus();
    };

    socket.on('deploy:log', handleDeployLog);
    socket.on('deploy:status', handleDeployStatus);
    socket.on('deploy:finished', handleDeployFinished);

    return () => {
      socket.off('deploy:log', handleDeployLog);
      socket.off('deploy:status', handleDeployStatus);
      socket.off('deploy:finished', handleDeployFinished);
    };
  }, [socket, fetchHealth, fetchStatus]);

  useEffect(() => {
    if (showLogsModal && typeof logsEndRef.current?.scrollIntoView === 'function') {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [status?.logs, showLogsModal]);

  const handleStartDeploy = async () => {
    const isSingleCt8 = selectedTargets.length === 1 && selectedTargets[0] === 'ct8';
    const confirmMessage = isSingleCt8
      ? `Czy na pewno chcesz uruchomić wdrożenie aplikacji "${activeApp.name}" na serwer CT8.pl (${activeApp.domain})?`
      : `Czy na pewno chcesz uruchomić wdrożenie aplikacji "${activeApp.name}" na ${selectedTargets.length} serwery (${selectedTargets.join(', ')})?`;

    if (!confirm(confirmMessage)) {
      return;
    }

    setActionLoading(true);
    setErrorMsg(null);
    try {
      await apiClient.post<{ success: boolean; message: string }>(
        '/api/deploy/start',
        {
          environment: 'production',
          confirm: 'DEPLOY_CT8',
          targets: selectedTargets,
          app: selectedApp,
        },
        {
          headers: {
            'x-admin-role': 'true',
            'x-deploy-confirm': 'DEPLOY_CT8',
          },
        }
      );
      setShowLogsModal(true);
      await fetchStatus();
    } catch (err: any) {
      setErrorMsg(err.message || 'Nie udało się uruchomić wdrożenia.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeployWorkspace = async (workspacePath?: string, workspaceName?: string) => {
    setActionLoading(true);
    setErrorMsg(null);
    try {
      await apiClient.post<{ success: boolean; message: string }>(
        '/api/deploy/start',
        {
          environment: deployEnv,
          confirm: 'DEPLOY_CT8',
          workspacePath: workspacePath || undefined,
          workspaceName: workspaceName || undefined,
        },
        {
          headers: {
            'x-admin-role': 'true',
            'x-deploy-confirm': 'DEPLOY_CT8',
          },
        }
      );
      setShowWorkspaceModal(false);
      setShowLogsModal(true);
      await fetchStatus();
    } catch (err: any) {
      setErrorMsg(err.message || 'Nie udało się uruchomić wdrożenia wybranego workspace.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCopyLogs = async () => {
    if (!status?.logs || status.logs.length === 0) return;
    const textToCopy = status.logs
      .filter((l) => {
        if (activeLogTab === 'all') return true;
        return l.target === activeLogTab || (!l.target && activeLogTab === 'ct8');
      })
      .map((l) => `[${l.timestamp}]${l.target ? ` [${l.target.toUpperCase()}]` : ''} ${cleanLogLine(l.text)}`)
      .filter((line) => line.length > 12)
      .join('\n');
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedLogs(true);
      setTimeout(() => setCopiedLogs(false), 2500);
    } catch (err) {
      console.error('Błąd kopiowania logów:', err);
    }
  };

  const handleCopyRestartCmd = async () => {
    try {
      await navigator.clipboard.writeText(currentRestartCmd);
      setCopiedRestartCmd(true);
      setTimeout(() => setCopiedRestartCmd(false), 2500);
    } catch (err) {
      console.error('Błąd kopiowania komendy:', err);
    }
  };

  const handleAbortDeploy = async () => {
    if (!confirm('Czy na pewno chcesz natychmiast przerwać wdrożenie i ubić aktywny proces wdrożenia?')) {
      return;
    }

    setAbortingDeploy(true);
    setErrorMsg(null);
    try {
      const res = await apiClient.post<{ success: boolean; message: string }>(
        '/api/deploy/abort',
        {},
        { headers: { 'x-admin-role': 'true' } }
      );
      setSuccessMsg(res.message || 'Proces wdrożenia został przerwany.');
      setTimeout(() => setSuccessMsg(null), 5000);
      await fetchStatus();
    } catch (err: any) {
      setErrorMsg(err.message || 'Nie udało się ubić procesu wdrożenia.');
    } finally {
      setAbortingDeploy(false);
    }
  };

  const handleKillRemoteProcesses = async (target: string = 'ct8') => {
    const isCt8 = target === 'ct8';
    const targetLabel = isCt8 ? `CT8.pl (${activeApp.domain})` : target.toUpperCase();
    if (!confirm(`Czy na pewno chcesz ubić wiszące procesy (Node.js/zsh) na serwerze ${targetLabel} i zrestartować aplikację?`)) {
      return;
    }

    setKillingRemote(true);
    setErrorMsg(null);
    try {
      const res = await apiClient.post<{ success: boolean; message: string }>(
        '/api/deploy/kill-remote',
        { target, app: selectedApp, domain: activeApp.domain },
        { headers: { 'x-admin-role': 'true' } }
      );
      setSuccessMsg(res.message || 'Zawieszone procesy zdalne zostały ubite, a aplikacja zrestartowana.');
      setTimeout(() => setSuccessMsg(null), 6000);
      await Promise.all([fetchStatus(), fetchHealth(selectedApp)]);
    } catch (err: any) {
      setErrorMsg(err.message || 'Nie udało się ubić procesów zdalnych.');
    } finally {
      setKillingRemote(false);
    }
  };

  const toggleTarget = (targetId: string) => {
    if (selectedTargets.includes(targetId)) {
      if (selectedTargets.length > 1) {
        setSelectedTargets(selectedTargets.filter((id) => id !== targetId));
      }
    } else {
      setSelectedTargets([...selectedTargets, targetId]);
    }
  };

  const isDeploying = status?.isDeploying || false;
  const currentLogs = status?.logs;

  const filteredLogs = useMemo(() => {
    if (!currentLogs) return [];
    return currentLogs
      .filter((l) => {
        if (activeLogTab === 'all') return true;
        return l.target === activeLogTab || (!l.target && activeLogTab === 'ct8');
      })
      .map((l) => ({ ...l, text: cleanLogLine(l.text) }))
      .filter((l) => l.text.length > 0)
      .filter((l) => {
        if (!logFilter.trim()) return true;
        return l.text.toLowerCase().includes(logFilter.toLowerCase());
      });
  }, [currentLogs, activeLogTab, logFilter]);

  return (
    <>
      <div
        className={`bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-md text-white transition-colors hover:border-slate-700 ${className}`}
        style={{ letterSpacing: '-0.01em' }}
      >
        {/* Nagłówek Widgetu */}
        <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-800">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-500/20 to-emerald-500/20 border border-indigo-500/30 text-indigo-400 shadow-inner">
              <Rocket className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-base text-slate-100 tracking-tight truncate">
                  Wdrożenie CT8.pl / Multi-Deploy
                </h3>
                <a
                  href={`https://${activeApp.domain}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-slate-400 hover:text-emerald-400 transition-colors p-1 rounded-md hover:bg-slate-800"
                  title={`Otwórz aplikację ${activeApp.name} w nowej karcie`}
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">{activeApp.domain}</p>
            </div>
          </div>

          {/* Dioda Healthcheck & Przycisk Odświeżania */}
          <div className="flex items-center gap-2.5">
            {health?.healthy ? (
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-sm">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                Działa ({health.latencyMs} ms)
              </span>
            ) : health && !health.healthy ? (
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30 shadow-sm">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                Offline
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-slate-800 text-slate-400">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Sprawdzanie…
              </span>
            )}

            {/* Przycisk Ubicia procesów zdalnych / awaryjny restart */}
            <button
              onClick={() => handleKillRemoteProcesses('ct8')}
              disabled={killingRemote}
              className="w-9 h-9 flex items-center justify-center text-rose-400 hover:text-rose-200 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition-colors disabled:opacity-50 cursor-pointer"
              title="Ubij zawieszone procesy na serwerze CT8 (Node.js/zsh) i zrestartuj domenę"
              aria-label="Ubij zawieszone procesy CT8"
            >
              {killingRemote ? (
                <RefreshCw className="w-4 h-4 animate-spin text-rose-400" />
              ) : (
                <OctagonX className="w-4 h-4 text-rose-400" />
              )}
            </button>

            <button
              onClick={refreshAll}
              disabled={loading}
              className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-white rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 transition-colors disabled:opacity-50 cursor-pointer"
              title="Odśwież stan serwera i wdrożenia"
              aria-label="Odśwież status wdrożenia"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Informacje o ostatnim wdrożeniu */}
        <div className="grid grid-cols-2 gap-3.5 mb-4 text-xs tabular-nums">
          <div className="p-3.5 bg-slate-950/70 rounded-xl border border-slate-800/80 shadow-sm">
            <span className="text-slate-400 font-medium block mb-1.5">Status ostatniego wdrożenia</span>
            <div className="flex items-center gap-2 font-semibold">
              {status?.lastDeploy?.status === 'SUCCESS' ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-emerald-300">Pomyślny ({status.lastDeploy.durationSeconds}s)</span>
                </>
              ) : status?.lastDeploy?.status === 'FAILED' ? (
                <>
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span className="text-rose-300 truncate" title={status.lastDeploy.error || 'Niepowodzenie'}>
                    Niepowodzenie
                  </span>
                </>
              ) : isDeploying ? (
                <>
                  <RefreshCw className="w-4 h-4 text-amber-400 animate-spin shrink-0" />
                  <span className="text-amber-300">W toku…</span>
                </>
              ) : (
                <span className="text-slate-400 font-normal">Brak historii</span>
              )}
            </div>
          </div>

          <div className="p-3.5 bg-slate-950/70 rounded-xl border border-slate-800/80 shadow-sm">
            <span className="text-slate-400 font-medium block mb-1.5">Data ostatniej operacji</span>
            <div className="flex items-center gap-2 font-medium text-slate-200">
              <Clock className="w-4 h-4 text-slate-400 shrink-0" />
              <span>
                {status?.lastDeploy?.timestamp
                  ? new Date(status.lastDeploy.timestamp).toLocaleString('pl-PL', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Konfiguracja Wdrożenia: Aplikacja + Cele (Elastyczny układ responsywny) */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3.5 mb-4">
          {/* Wybór Aplikacji do wdrożenia */}
          <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800/80 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                  Aplikacja do wdrożenia
                </span>
                <span className="text-[11px] text-slate-400 font-mono truncate max-w-[140px]" title={activeApp.domain}>
                  {activeApp.domain}
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                {appsList.map((app) => {
                  const isSelected = selectedApp === app.id;
                  return (
                    <button
                      type="button"
                      key={app.id}
                      aria-pressed={isSelected}
                      onClick={() => handleSelectApp(app.id)}
                      title={`${app.name} (${app.domain})`}
                      className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs font-medium border cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500 ${
                        isSelected
                          ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-200 shadow-sm'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-2 h-2 shrink-0 rounded-full ${isSelected ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]' : 'bg-slate-600'}`} aria-hidden="true" />
                        <span className="truncate">{app.name}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono shrink-0">({app.domain})</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Multi-Deploy: Wybór Celów Wdrożenia */}
          <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800/80 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-indigo-400" aria-hidden="true" />
                  Cele Wdrożenia (Multi-Deploy)
                </span>
                <div className="flex items-center gap-1.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setSelectedTargets(targetsList.map((t) => t.id))}
                    className="text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer px-1.5 py-0.5 rounded hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500"
                  >
                    Wszystkie ({targetsList.length})
                  </button>
                  <span className="text-slate-600">|</span>
                  <button
                    type="button"
                    onClick={() => setSelectedTargets(['ct8'])}
                    className="text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer px-1.5 py-0.5 rounded hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500"
                  >
                    Tylko CT8
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                {targetsList.map((target) => {
                  const isChecked = selectedTargets.includes(target.id);
                  return (
                    <button
                      type="button"
                      key={target.id}
                      aria-pressed={isChecked}
                      onClick={() => toggleTarget(target.id)}
                      title={`${target.name} (${target.host})`}
                      className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs font-medium border cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 ${
                        isChecked
                          ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-200 shadow-sm'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-2 h-2 shrink-0 rounded-full ${isChecked ? 'bg-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.6)]' : 'bg-slate-600'}`} aria-hidden="true" />
                        <span className="truncate">{target.name}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono shrink-0">({target.host})</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Komunikat o sukcesie operacji (np. ubicie procesów) */}
        {successMsg && (
          <div className="mb-4 p-3.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs rounded-xl flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
            <button
              onClick={() => setSuccessMsg(null)}
              className="text-emerald-400 hover:text-emerald-200 p-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Komunikat o błędzie jeśli wystąpił */}
        {errorMsg && (
          <div className="mb-4 p-3.5 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs rounded-xl flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
            <button
              onClick={() => setErrorMsg(null)}
              className="text-rose-400 hover:text-rose-200 p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Bieżący krok jeśli w trakcie wdrożenia */}
        {isDeploying && (
          <div className="mb-4 p-4 bg-indigo-500/10 border border-indigo-500/30 rounded-xl">
            <div className="flex items-center justify-between text-xs text-indigo-300 mb-2">
              <span className="font-semibold flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                {status?.currentStep || 'Przetwarzanie wdrożenia…'}
              </span>
            </div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div className="bg-gradient-to-r from-indigo-500 to-emerald-400 h-full rounded-full animate-pulse w-3/4" />
            </div>
          </div>
        )}

        {/* Duże Przyciski Akcji */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleStartDeploy}
            disabled={isDeploying || actionLoading || selectedTargets.length === 0}
            className="flex-1 flex items-center justify-center gap-2.5 py-3.5 px-6 rounded-xl font-semibold text-sm transition-colors shadow-lg bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-400 text-white disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-[0.99]"
          >
            {isDeploying ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                Wdrażanie w toku…
              </>
            ) : selectedTargets.length > 1 ? (
              <>
                <Rocket className="w-5 h-5" />
                Wdróż na wybrane ({selectedTargets.length})
              </>
            ) : (
              <>
                <Rocket className="w-5 h-5" />
                Wdróż {activeApp.id === 'dashboard' ? '' : `${activeApp.name.split(' ')[0]} `}na CT8
              </>
            )}
          </button>

          {isDeploying && (
            <button
              type="button"
              onClick={handleAbortDeploy}
              disabled={abortingDeploy}
              className="flex items-center justify-center gap-2 py-3.5 px-4 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-sm font-semibold border border-rose-500 transition-colors cursor-pointer shadow-lg active:scale-[0.99] disabled:opacity-50"
              title="Ubij zawieszony proces wdrożenia (SIGKILL)"
              aria-label="Ubij proces wdrożenia"
            >
              <OctagonX className={`w-4 h-4 ${abortingDeploy ? 'animate-spin' : ''}`} />
              <span>{abortingDeploy ? 'Ubija…' : 'Ubij proces'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowWorkspaceModal(true)}
            disabled={isDeploying || actionLoading}
            className="flex items-center justify-center gap-2 py-3.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs md:text-sm font-semibold border border-slate-700 transition-colors cursor-pointer shadow-sm active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50"
            title="Dodaj nowe wdrożenie z innego Workspace"
          >
            <FolderGit2 className="w-4 h-4 text-indigo-400" />
            Inny Workspace
          </button>

          <button
            onClick={() => setShowLogsModal(true)}
            className="flex items-center justify-center gap-2 py-3.5 px-5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-sm font-semibold border border-slate-700 transition-colors cursor-pointer shadow-sm active:scale-[0.99]"
            title="Otwórz pełną konsolę logów wdrożenia"
          >
            <Terminal className="w-4 h-4 text-emerald-400" />
            Logi {status?.logs && status.logs.length > 0 && `(${status.logs.length})`}
          </button>
        </div>

        {/* Pasek szybkiego restartu / ubicia procesów zdalnych */}
        <div className="mt-4 pt-3.5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
          <div className="flex items-center gap-2 truncate pr-2">
            <span className="truncate">
              Restart: <code className="text-slate-300 font-mono text-[11px] bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">devil www restart {activeApp.domain}</code>
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleKillRemoteProcesses('ct8')}
              disabled={killingRemote}
              className="flex items-center gap-1.5 text-rose-400 hover:text-rose-200 px-2.5 py-1 rounded-md bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-colors text-xs font-medium cursor-pointer disabled:opacity-50"
              title="Ubij wiszące procesy (Node.js/zsh) na serwerze CT8 i zrestartuj aplikację"
            >
              {killingRemote ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-rose-400" />
                  <span>Ubija procesy…</span>
                </>
              ) : (
                <>
                  <OctagonX className="w-3.5 h-3.5 text-rose-400" />
                  <span>Ubij procesy CT8</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleCopyRestartCmd}
              className="flex items-center gap-1 text-slate-400 hover:text-slate-200 px-2 py-1 rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
              title="Kopiuj polecenie SSH do restartu aplikacji"
            >
              {copiedRestartCmd ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 font-medium">Skopiowano!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Kopiuj SSH</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Przeprojektowany Modal / Konsola logów na żywo z obsługą Multi-Deploy */}
      {showLogsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-4xl flex flex-col h-[82vh] shadow-2xl overflow-hidden">
            {/* Nagłówek Modalu w stylu konsoli */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 mr-1">
                  <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                  <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                </div>
                <div className="h-4 w-px bg-slate-800 mx-1" />
                <Terminal className="w-4 h-4 text-emerald-400" />
                <div>
                  <h4 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                    Konsola Wdrożenia CT8.pl / Multi-Deploy
                    {isDeploying && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-normal text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        Transmisja na żywo
                      </span>
                    )}
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    {status?.currentStep || 'Podgląd operacji strumieniowanych przez WebSocket'}
                  </p>
                </div>
              </div>

              {/* Akcje nagłówka modalu */}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={logFilter}
                    onChange={(e) => setLogFilter(e.target.value)}
                    placeholder="Filtruj logi…"
                    className="w-40 md:w-52 bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <button
                  onClick={handleCopyLogs}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700 transition-colors cursor-pointer"
                  title="Kopiuj zawartość logów do schowka"
                >
                  {copiedLogs ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Skopiowano</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Kopiuj</span>
                    </>
                  )}
                </button>

                {isDeploying && (
                  <button
                    type="button"
                    onClick={handleAbortDeploy}
                    disabled={abortingDeploy}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600/90 hover:bg-rose-500 text-white rounded-lg text-xs font-medium border border-rose-500/80 transition-colors cursor-pointer disabled:opacity-50"
                    title="Natychmiast przerwij wdrożenie i ubić proces"
                  >
                    <OctagonX className={`w-3.5 h-3.5 ${abortingDeploy ? 'animate-spin' : ''}`} />
                    <span>Ubij wdrożenie</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleKillRemoteProcesses('ct8')}
                  disabled={killingRemote}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-rose-950/60 text-rose-300 rounded-lg text-xs font-medium border border-rose-500/30 transition-colors cursor-pointer disabled:opacity-50"
                  title="Ubij wiszące procesy zdalne na CT8 (Node.js/zsh) i zrestartuj domenę"
                >
                  <OctagonX className={`w-3.5 h-3.5 ${killingRemote ? 'animate-spin text-rose-400' : 'text-rose-400'}`} />
                  <span>Ubij procesy CT8</span>
                </button>

                <button
                  onClick={() => setShowLogsModal(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors ml-1 cursor-pointer"
                  title="Zamknij okno"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Pasek zakładek celów (Multi-Deploy Tabs) */}
            <div className="flex items-center gap-1 px-6 py-2.5 bg-slate-900 border-b border-slate-800 text-xs overflow-x-auto">
              <span className="text-[11px] text-slate-500 mr-2 uppercase tracking-wider font-semibold shrink-0">
                Zakładka serwera:
              </span>
              <button
                type="button"
                onClick={() => setActiveLogTab('all')}
                className={`px-3 py-1 rounded-md transition-colors cursor-pointer shrink-0 ${
                  activeLogTab === 'all'
                    ? 'bg-indigo-600 text-white font-medium shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                Wszystkie logi ({currentLogs?.length || 0})
              </button>
              {targetsList.map((target) => {
                const count = (currentLogs || []).filter(
                  (l) => l.target === target.id || (!l.target && target.id === 'ct8')
                ).length;
                return (
                  <button
                    key={target.id}
                    type="button"
                    onClick={() => setActiveLogTab(target.id)}
                    className={`px-3 py-1 rounded-md transition-colors cursor-pointer shrink-0 ${
                      activeLogTab === target.id
                        ? 'bg-indigo-600 text-white font-medium shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    {target.name} ({count})
                  </button>
                );
              })}
            </div>

            {/* Treść logów (Terminal konsoli) */}
            <div className="flex-1 p-5 overflow-y-auto font-mono text-xs text-slate-300 bg-black/95 space-y-1.5 select-text">
              {filteredLogs.length > 0 ? (
                filteredLogs.map((log, index) => {
                  const lineText = log.text;
                  const isSuccess =
                    lineText.includes('[OK]') ||
                    lineText.includes('SUCCESS') ||
                    lineText.includes('DEPLOYMENT COMPLETE');
                  const isError =
                    lineText.includes('[ERROR]') ||
                    lineText.includes('Błąd') ||
                    lineText.includes('FAILED');
                  const isStep = lineText.includes('STEP') || lineText.startsWith('===');
                  const isCmd =
                    lineText.includes('ssh ') ||
                    lineText.includes('devil ') ||
                    lineText.includes('git ');

                  return (
                    <div
                      key={index}
                      className={`flex gap-3 leading-relaxed px-2 py-0.5 rounded transition-colors ${
                        isStep
                          ? 'bg-indigo-950/40 border-l-2 border-indigo-500 my-1'
                          : isSuccess
                          ? 'bg-emerald-950/20'
                          : isError
                          ? 'bg-rose-950/30 border-l-2 border-rose-500'
                          : 'hover:bg-slate-900/40'
                      }`}
                    >
                      <span className="text-slate-600 select-none text-[11px] shrink-0 font-mono pt-0.5">
                        [{log.timestamp}]
                        {log.target && (
                          <span className="ml-1 px-1.5 py-0.2 bg-slate-800 text-indigo-300 rounded text-[10px] uppercase">
                            {log.target}
                          </span>
                        )}
                      </span>
                      <span
                        className={`break-all ${
                          isStep
                            ? 'text-indigo-300 font-semibold text-xs tracking-wide'
                            : isSuccess
                            ? 'text-emerald-400 font-semibold'
                            : isError
                            ? 'text-rose-400 font-semibold'
                            : isCmd
                            ? 'text-cyan-300 font-semibold'
                            : 'text-slate-300'
                        }`}
                      >
                        {lineText}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="text-slate-500 italic py-12 text-center text-xs">
                  {logFilter
                    ? `Brak logów pasujących do filtra: "${logFilter}"`
                    : 'Brak zapisanych logów z bieżącej sesji wdrożenia.'}
                </div>
              )}
              <div ref={logsEndRef} />
            </div>

            {/* Stopka Modalu z dużymi przyciskami */}
            <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${isDeploying ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'}`} />
                <span>
                  {isDeploying
                    ? 'Proces w toku: nasłuchiwanie wyjścia w czasie rzeczywistym…'
                    : 'Wykonywanie zakończone.'}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleCopyRestartCmd}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl font-medium transition-colors cursor-pointer"
                  title="Kopiuj polecenie do restartu aplikacji"
                >
                  Kopiuj komendę restartu
                </button>
                <button
                  onClick={() => setShowLogsModal(false)}
                  className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold transition-colors shadow-md cursor-pointer"
                >
                  Zamknij
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Modal: Nowe wdrożenie z innego Workspace */}
      {showWorkspaceModal && (
        <div 
          role="dialog"
          aria-modal="true"
          aria-labelledby="workspace-deploy-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 bg-black/75 backdrop-blur-md overscroll-contain animate-in fade-in duration-150"
        >
          <div className="bg-slate-950 border border-slate-800 rounded-2xl max-w-xl w-full p-6 md:p-7 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400">
                  <FolderGit2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 id="workspace-deploy-title" className="font-semibold text-slate-100 text-base">
                    Nowe wdrożenie z innego Workspace
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Wybierz projekt lub podaj ścieżkę do wdrożenia na serwer produkcyjny
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowWorkspaceModal(false)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                aria-label="Zamknij okno wyboru workspace"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  Dostępne Workspace w Dashboardzie:
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {projects.map((proj) => (
                    <button
                      key={proj.id}
                      type="button"
                      onClick={() => { setSelectedProject(proj); setCustomPath(''); }}
                      className={`w-full text-left p-3 rounded-xl border text-xs transition-colors cursor-pointer flex items-center justify-between ${
                        selectedProject?.id === proj.id && !customPath
                          ? 'border-indigo-500 bg-indigo-500/15 text-indigo-200 ring-1 ring-indigo-500/50'
                          : 'border-slate-800/90 bg-slate-900/60 text-slate-300 hover:border-slate-700 hover:bg-slate-900'
                      }`}
                    >
                      <div>
                        <span className="font-semibold block text-slate-100 text-sm tracking-tight">{proj.name}</span>
                        <span className="text-[11px] text-slate-400 font-mono block mt-0.5">{proj.path}</span>
                      </div>
                      {selectedProject?.id === proj.id && !customPath && (
                        <Check className="w-4 h-4 text-indigo-400 shrink-0 ml-2" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="customWorkspaceInput" className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Lub wpisz własną ścieżkę katalogu roboczego:
                </label>
                <input
                  id="customWorkspaceInput"
                  type="text"
                  value={customPath}
                  onChange={(e) => { setCustomPath(e.target.value); setSelectedProject(null); }}
                  placeholder="np. /mnt/f/AI-Agents/invoice-splitter"
                  className="w-full font-mono bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label htmlFor="deployServerSelect" className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Serwer docelowy:
                  </label>
                  <select
                    id="deployServerSelect"
                    value={targetServer}
                    onChange={(e) => setTargetServer(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="dashboard.jagger2.ct8.pl">CT8.pl (dashboard.jagger2.ct8.pl)</option>
                    <option value="10.10.10.100">OMV (root@10.10.10.100)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="deployEnvSelect" className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Środowisko:
                  </label>
                  <select
                    id="deployEnvSelect"
                    value={deployEnv}
                    onChange={(e) => setDeployEnv(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="production">Produkcyjne (production)</option>
                    <option value="staging">Testowe (staging)</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800/80 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowWorkspaceModal(false)}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Anuluj
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const effPath = customPath.trim() || selectedProject?.path;
                    const effName = customPath.trim() ? 'Custom Workspace' : selectedProject?.name;
                    handleDeployWorkspace(effPath, effName);
                  }}
                  disabled={actionLoading || (!selectedProject && !customPath.trim())}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs font-semibold transition-colors shadow-md disabled:opacity-50 cursor-pointer active:scale-[0.99]"
                >
                  <Rocket className="w-4 h-4 inline mr-1.5" />
                  Wdróż Workspace
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
