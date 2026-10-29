import React, { useState, useEffect, useRef } from 'react';
import { Rocket, CheckCircle2, AlertCircle, RefreshCw, Terminal, Clock, ExternalLink, X, ShieldAlert } from 'lucide-react';
import { apiClient } from '../shared/api-client';
import { useDashboardSocket } from '../hooks/useDashboardSocket';

interface DeployStatus {
  state: 'IDLE' | 'RUNNING' | 'SUCCESS' | 'FAILED';
  isDeploying: boolean;
  currentStep: string;
  startTime: string | null;
  logs: { timestamp: string; text: string }[];
  lastDeploy: {
    status: string;
    timestamp: string | null;
    durationSeconds: number;
    targetHost: string;
    error: string | null;
  };
  targetHost: string;
}

interface DeployHealth {
  healthy: boolean;
  statusCode: number;
  latencyMs: number;
  timestamp: string;
  error?: string;
}

interface DeployCt8WidgetProps {
  className?: string;
}

export const DeployCt8Widget: React.FC<DeployCt8WidgetProps> = ({ className = '' }) => {
  const [status, setStatus] = useState<DeployStatus | null>(null);
  const [health, setHealth] = useState<DeployHealth | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [showLogsModal, setShowLogsModal] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const logsEndRef = useRef<HTMLDivElement>(null);

  // Hook do nasłuchiwania WebSocket z /dashboard
  const { socket } = useDashboardSocket();

  const fetchStatus = async () => {
    try {
      const data = await apiClient.get<DeployStatus>('/api/deploy/status');
      setStatus(data);
    } catch (err: any) {
      console.error('Błąd pobierania statusu wdrożenia:', err);
    }
  };

  const fetchHealth = async () => {
    try {
      const data = await apiClient.get<DeployHealth>('/api/deploy/health');
      setHealth(data);
    } catch (err: any) {
      console.error('Błąd pobierania healthchecku CT8:', err);
    }
  };

  const refreshAll = async () => {
    setLoading(true);
    await Promise.all([fetchStatus(), fetchHealth()]);
    setLoading(false);
  };

  useEffect(() => {
    refreshAll();
    const interval = setInterval(fetchHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  // Nasłuchiwanie Socket.IO na zdarzenia deploy
  useEffect(() => {
    if (!socket) return;

    const handleDeployLog = (logEntry: { timestamp: string; text: string }) => {
      setStatus((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          logs: [...prev.logs.slice(-250), logEntry],
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
  }, [socket]);

  useEffect(() => {
    if (showLogsModal && typeof logsEndRef.current?.scrollIntoView === 'function') {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [status?.logs, showLogsModal]);

  const handleStartDeploy = async () => {
    if (!confirm('Czy na pewno chcesz uruchomić wdrożenie produkcyjne na serwer CT8.pl?')) {
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

  const isDeploying = status?.isDeploying || false;

  return (
    <>
      <div
        className={`bg-gray-900/80 border border-gray-800 rounded-2xl p-5 shadow-xl backdrop-blur-md text-white transition-all hover:border-gray-700 ${className}`}
        style={{ letterSpacing: '-0.01em' }}
      >
        {/* Nagłówek Widgetu */}
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-800/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500/20 to-emerald-500/20 border border-indigo-500/30 text-indigo-400">
              <Rocket className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-gray-100 flex items-center gap-2">
                Wdrożenie CT8.pl
                <a
                  href="https://dashboard.jagger2.ct8.pl"
                  target="_blank"
                  rel="noreferrer"
                  className="text-gray-400 hover:text-emerald-400 transition-colors"
                  title="Otwórz produkcję w nowej karcie"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </h3>
              <p className="text-xs text-gray-400 font-mono">dashboard.jagger2.ct8.pl</p>
            </div>
          </div>

          {/* Dioda Healthcheck */}
          <div className="flex items-center gap-2">
            {health?.healthy ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Działa ({health.latencyMs} ms)
              </span>
            ) : health && !health.healthy ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/30">
                <span className="w-2 h-2 rounded-full bg-rose-400" />
                Offline
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-800 text-gray-400">
                <RefreshCw className="w-3 h-3 animate-spin" />
                Sprawdzanie...
              </span>
            )}

            <button
              onClick={refreshAll}
              disabled={loading}
              className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
              title="Odśwież status"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Informacje o ostatnim wdrożeniu */}
        <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
          <div className="p-3 bg-gray-950/60 rounded-xl border border-gray-800/60">
            <span className="text-gray-400 block mb-1">Status ostatniego deployu</span>
            <div className="flex items-center gap-1.5 font-medium">
              {status?.lastDeploy?.status === 'SUCCESS' ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-300">Pomyślny ({status.lastDeploy.durationSeconds}s)</span>
                </>
              ) : status?.lastDeploy?.status === 'FAILED' ? (
                <>
                  <AlertCircle className="w-4 h-4 text-rose-400" />
                  <span className="text-rose-300">Niepowodzenie</span>
                </>
              ) : isDeploying ? (
                <>
                  <RefreshCw className="w-4 h-4 text-amber-400 animate-spin" />
                  <span className="text-amber-300">W toku...</span>
                </>
              ) : (
                <span className="text-gray-400">Brak danych</span>
              )}
            </div>
          </div>

          <div className="p-3 bg-gray-950/60 rounded-xl border border-gray-800/60">
            <span className="text-gray-400 block mb-1">Czas ostatniej operacji</span>
            <div className="flex items-center gap-1.5 font-medium text-gray-200">
              <Clock className="w-4 h-4 text-gray-400" />
              <span>
                {status?.lastDeploy?.timestamp
                  ? new Date(status.lastDeploy.timestamp).toLocaleString('pl-PL', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Komunikat o błędzie jeśli wystąpił */}
        {errorMsg && (
          <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs rounded-xl flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Bieżący krok jeśli w trakcie wdrożenia */}
        {isDeploying && (
          <div className="mb-4 p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-xl">
            <div className="flex items-center justify-between text-xs text-indigo-300 mb-1.5">
              <span className="font-medium flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                {status?.currentStep || 'Przetwarzanie wdrożenia...'}
              </span>
            </div>
            <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden">
              <div className="bg-indigo-500 h-full rounded-full animate-pulse w-3/4" />
            </div>
          </div>
        )}

        {/* Przyciski akcji */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleStartDeploy}
            disabled={isDeploying || actionLoading}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-medium text-xs transition-all shadow-md bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-[0.98]"
          >
            {isDeploying ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Wdrażanie w toku...
              </>
            ) : (
              <>
                <Rocket className="w-3.5 h-3.5" />
                Wdróż na CT8
              </>
            )}
          </button>

          <button
            onClick={() => setShowLogsModal(true)}
            className="flex items-center gap-1.5 py-2.5 px-3 bg-gray-800 hover:bg-gray-700/80 text-gray-300 hover:text-white rounded-xl text-xs font-medium border border-gray-700/60 transition-colors cursor-pointer"
            title="Podgląd konsoli wdrożenia"
          >
            <Terminal className="w-3.5 h-3.5 text-gray-400" />
            Logi
          </button>
        </div>
      </div>

      {/* Modal / Konsola logów na żywo */}
      {showLogsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-gray-950 border border-gray-800 rounded-2xl w-full max-w-3xl flex flex-col h-[75vh] shadow-2xl overflow-hidden">
            {/* Nagłówek Modalu */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-800 bg-gray-900/50">
              <div className="flex items-center gap-2.5">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <h4 className="text-sm font-semibold text-gray-200">
                  Konsola Wdrożenia CT8.pl — {status?.currentStep || 'Status wdrożenia'}
                </h4>
              </div>
              <button
                onClick={() => setShowLogsModal(false)}
                className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Treść logów (Terminal) */}
            <div className="flex-1 p-4 overflow-y-auto font-mono text-xs text-gray-300 bg-black/90 space-y-1 select-text">
              {status?.logs && status.logs.length > 0 ? (
                status.logs.map((log, index) => (
                  <div key={index} className="flex gap-2 leading-relaxed">
                    <span className="text-gray-500 select-none">[{log.timestamp}]</span>
                    <span
                      className={
                        log.text.includes('[OK]')
                          ? 'text-emerald-400 font-semibold'
                          : log.text.includes('[ERROR]') || log.text.includes('Błąd')
                          ? 'text-rose-400 font-semibold'
                          : log.text.includes('STEP')
                          ? 'text-indigo-300 font-semibold underline'
                          : 'text-gray-300'
                      }
                    >
                      {log.text}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-gray-500 italic py-8 text-center">Brak zapisanych logów z bieżącej sesji.</div>
              )}
              <div ref={logsEndRef} />
            </div>

            {/* Stopka Modalu */}
            <div className="px-5 py-3 border-t border-gray-800 bg-gray-900/50 flex items-center justify-between text-xs text-gray-400">
              <span>{isDeploying ? 'Trwa strumieniowanie wyjścia procesu...' : 'Wykonywanie zakończone.'}</span>
              <button
                onClick={() => setShowLogsModal(false)}
                className="px-4 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg transition-colors cursor-pointer"
              >
                Zamknij
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
