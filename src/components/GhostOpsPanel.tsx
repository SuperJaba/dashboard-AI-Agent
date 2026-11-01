import { useState, useEffect, useCallback } from 'react';
import {
  Bot,
  Play,
  CheckCircle2,
  AlertCircle,
  GitPullRequest,
  ExternalLink,
  Loader2,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { apiClient } from '../shared/api-client';

export interface GhostOpsRunItem {
  runId: number;
  workflowName: string;
  headSha?: string;
  branchName?: string;
  status: 'success' | 'error' | 'none';
  prUrl?: string | null;
  prNumber?: number | null;
  error?: string | null;
  timestamp: string;
}

interface GhostOpsHistoryResponse {
  history?: GhostOpsRunItem[];
  runs?: GhostOpsRunItem[];
}

interface GhostOpsRunResponse {
  success: boolean;
  totalFailures?: number;
  processed?: number;
  successful?: number;
  failed?: number;
  runs?: GhostOpsRunItem[];
  error?: string;
}

export function GhostOpsPanel() {
  const [runs, setRuns] = useState<GhostOpsRunItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  const fetchHistory = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await apiClient.get<GhostOpsHistoryResponse>('/api/ghostops/history');
      const historyList = res?.history || res?.runs || [];
      setRuns(historyList);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Nie udało się pobrać historii';
      setFeedbackMessage({ text: `Błąd historii: ${msg}`, isError: true });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleManualRun = async () => {
    try {
      setIsRunning(true);
      setFeedbackMessage(null);
      const res = await apiClient.post<GhostOpsRunResponse>('/api/ghostops/run', { hoursBack: 24 });

      if (res?.runs && Array.isArray(res.runs)) {
        setRuns((prev) => [...res.runs!, ...prev]);
        setFeedbackMessage({
          text: `Wykonano cykl Ghost Ops: przetworzono ${res.processed ?? res.runs.length}, naprawiono: ${res.successful ?? 0}`,
        });
      } else {
        setFeedbackMessage({ text: 'Cykl zakończony: brak nowych awarii do naprawy.' });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Nieznany błąd';
      setFeedbackMessage({ text: `Błąd wykonania: ${msg}`, isError: true });
    } finally {
      setIsRunning(false);
    }
  };

  const totalErrors = runs.filter((r) => r.status === 'error').length;
  const totalPrs = runs.filter((r) => Boolean(r.prUrl)).length;
  const lastRunTime = runs.length > 0 && runs[0]?.timestamp
    ? new Date(runs[0].timestamp).toLocaleString('pl-PL')
    : 'Brak';

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl border border-purple-500/20">
            <Bot size={28} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Ghost Ops — Nocny Autonomiczny Demon Samonaprawiający
            </h1>
            <p className="text-sm text-muted-foreground">
              Samodzielne monitorowanie GitHub Actions CI, reprodukcja w worktree i otwieranie fix PR.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleManualRun}
          disabled={isRunning}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-all disabled:opacity-50 shadow-sm"
        >
          {isRunning ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>Analizowanie CI...</span>
            </>
          ) : (
            <>
              <Play size={16} />
              <span>Uruchom teraz</span>
            </>
          )}
        </button>
      </div>

      {/* Feedback Message */}
      {feedbackMessage && (
        <div
          role="status"
          className={`p-4 rounded-lg text-sm border flex items-center gap-2 ${
            feedbackMessage.isError
              ? 'bg-destructive/10 border-destructive/30 text-destructive'
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
          }`}
        >
          {feedbackMessage.isError ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
          <span>{feedbackMessage.text}</span>
        </div>
      )}

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card/50 border border-border/60 rounded-xl p-4 flex items-center gap-3">
          <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-lg">
            <Clock size={20} />
          </div>
          <div>
            <div className="text-xs text-muted-foreground uppercase font-semibold">Ostatni run</div>
            <div className="text-sm font-medium text-foreground truncate">{lastRunTime}</div>
          </div>
        </div>

        <div className="bg-card/50 border border-border/60 rounded-xl p-4 flex items-center gap-3">
          <div className="p-2.5 bg-rose-500/10 text-rose-400 rounded-lg">
            <AlertCircle size={20} />
          </div>
          <div>
            <div className="text-xs text-muted-foreground uppercase font-semibold">Wykryte błędy</div>
            <div className="text-lg font-bold text-foreground">{totalErrors}</div>
          </div>
        </div>

        <div className="bg-card/50 border border-border/60 rounded-xl p-4 flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-lg">
            <GitPullRequest size={20} />
          </div>
          <div>
            <div className="text-xs text-muted-foreground uppercase font-semibold">Otwarte PR</div>
            <div className="text-lg font-bold text-foreground">{totalPrs}</div>
          </div>
        </div>
      </div>

      {/* History Section */}
      <div className="bg-card/40 border border-border/60 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border/40 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <ShieldCheck size={18} className="text-primary" />
            <span>Historia samonaprawczych przebiegów</span>
          </h2>
          <span className="text-xs text-muted-foreground">{runs.length} zarejestrowanych</span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 size={18} className="animate-spin" />
            <span>Ładowanie historii...</span>
          </div>
        ) : runs.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            Brak zarejestrowanych nocnych przebiegów. Kliknij &quot;Uruchom teraz&quot;, aby przeskanować CI.
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {runs.map((run, idx) => (
              <div
                key={`${run.runId}-${run.timestamp}-${idx}`}
                className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-muted/10 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-foreground">{run.workflowName}</span>
                    <span className="text-xs font-mono text-muted-foreground">#{run.runId}</span>
                    {run.status === 'success' && (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 size={12} />
                        <span>Sukces</span>
                      </span>
                    )}
                    {run.status === 'error' && (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/20">
                        <AlertCircle size={12} />
                        <span>Błąd</span>
                      </span>
                    )}
                    {run.status === 'none' && (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/20">
                        <span>Brak błędów</span>
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-3">
                    <span>{new Date(run.timestamp).toLocaleString('pl-PL')}</span>
                    {run.branchName && (
                      <span className="font-mono bg-muted/20 px-1.5 py-0.5 rounded">
                        {run.branchName}
                      </span>
                    )}
                  </div>
                  {run.error && (
                    <p className="text-xs text-rose-400 bg-rose-500/10 p-2 rounded border border-rose-500/20 mt-1">
                      {run.error}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 self-start md:self-center">
                  {run.prUrl ? (
                    <a
                      href={run.prUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-purple-500/15 text-purple-300 hover:bg-purple-500/25 border border-purple-500/30 transition-colors"
                    >
                      <GitPullRequest size={14} />
                      <span>PR #{run.prNumber ?? 'link'}</span>
                      <ExternalLink size={12} />
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground">Brak PR</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
