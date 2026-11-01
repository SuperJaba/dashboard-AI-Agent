import { useState, useEffect } from 'react';
import {
  Play, Square, CheckCircle, Clock, AlertTriangle,
  ShieldAlert, Sparkles, Box, RefreshCw, FileText
} from 'lucide-react';
import { apiClient } from '../shared/api-client';

export interface PipelineStep {
  id: string;
  name: string;
  agent?: string;
  role?: string;
  prompt?: string;
  dependsOn?: string[];
  requireApproval?: boolean;
  outputType?: 'spec' | 'code' | 'diff' | 'test_result' | 'deploy_log' | 'text';
}

export interface Pipeline {
  id: string;
  name: string;
  description?: string;
  status?: 'idle' | 'running' | 'completed' | 'failed' | 'aborted';
  steps: PipelineStep[];
  createdAt?: string;
}

export interface PipelineRunState {
  id: string;
  pipelineId: string;
  status: 'running' | 'paused' | 'completed' | 'failed' | 'aborted';
  currentStepId?: string;
  awaitingStepId?: string;
  completedSteps?: string[];
}

export interface PipelineArtifact {
  id: string;
  step_id: string;
  type: string;
  content: string;
  created_at: string;
}

interface PipelineBuilderProps {
  initialRun?: PipelineRunState;
  socket?: any;
}

export function PipelineBuilder({ initialRun, socket }: PipelineBuilderProps) {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [activePipelineId, setActivePipelineId] = useState<string | null>(null);
  const [currentRun, setCurrentRun] = useState<PipelineRunState | null>(initialRun || null);
  const [artifacts, setArtifacts] = useState<Record<string, PipelineArtifact[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; isError?: boolean } | null>(null);
  const [expandedArtifacts, setExpandedArtifacts] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchPipelines();
  }, []);

  useEffect(() => {
    if (initialRun) {
      setCurrentRun(initialRun);
      if (initialRun.pipelineId) {
        setActivePipelineId(initialRun.pipelineId);
      }
    }
  }, [initialRun]);

  // Socket.IO event binding
  useEffect(() => {
    if (!socket) return;

    const onRunStarted = (data: { runId: string; pipelineId: string }) => {
      setCurrentRun({
        id: data.runId,
        pipelineId: data.pipelineId,
        status: 'running',
        completedSteps: []
      });
    };

    const onStepStarted = (data: { runId: string; stepId: string }) => {
      setCurrentRun(prev => prev ? {
        ...prev,
        currentStepId: data.stepId,
        status: 'running',
        awaitingStepId: undefined
      } : null);
    };

    const onAwaitingApproval = (data: { runId: string; stepId: string }) => {
      setCurrentRun(prev => prev ? {
        ...prev,
        status: 'paused',
        awaitingStepId: data.stepId
      } : null);
    };

    const onStepDone = (data: { runId: string; stepId: string }) => {
      setCurrentRun(prev => {
        if (!prev) return null;
        const completed = prev.completedSteps || [];
        return {
          ...prev,
          completedSteps: completed.includes(data.stepId) ? completed : [...completed, data.stepId]
        };
      });
      if (currentRun?.id) {
        fetchArtifacts(currentRun.id);
      }
    };

    const onRunDone = () => {
      setCurrentRun(prev => prev ? { ...prev, status: 'completed', awaitingStepId: undefined } : null);
      fetchPipelines();
    };

    const onRunAborted = () => {
      setCurrentRun(prev => prev ? { ...prev, status: 'aborted', awaitingStepId: undefined } : null);
      fetchPipelines();
    };

    const onRunFailed = (data: { error: string }) => {
      setCurrentRun(prev => prev ? { ...prev, status: 'failed', awaitingStepId: undefined } : null);
      setFeedbackMsg({ text: `Błąd potoku: ${data.error}`, isError: true });
      fetchPipelines();
    };

    socket.on('pipeline:run_started', onRunStarted);
    socket.on('pipeline:step_started', onStepStarted);
    socket.on('pipeline:awaiting_approval', onAwaitingApproval);
    socket.on('pipeline:step_done', onStepDone);
    socket.on('pipeline:run_done', onRunDone);
    socket.on('pipeline:run_aborted', onRunAborted);
    socket.on('pipeline:run_failed', onRunFailed);

    return () => {
      socket.off('pipeline:run_started', onRunStarted);
      socket.off('pipeline:step_started', onStepStarted);
      socket.off('pipeline:awaiting_approval', onAwaitingApproval);
      socket.off('pipeline:step_done', onStepDone);
      socket.off('pipeline:run_done', onRunDone);
      socket.off('pipeline:run_aborted', onRunAborted);
      socket.off('pipeline:run_failed', onRunFailed);
    };
  }, [socket, currentRun?.id]);

  async function fetchPipelines() {
    try {
      setIsLoading(true);
      const data = await apiClient.get<Pipeline[]>('/api/pipelines');
      if (Array.isArray(data)) {
        setPipelines(data);
        if (data.length > 0 && !activePipelineId) {
          setActivePipelineId(data[0].id);
        }
      }
    } catch (err: any) {
      console.warn('Błąd pobierania potoków:', err.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchArtifacts(runId: string) {
    if (!activePipelineId) return;
    try {
      const list = await apiClient.get<PipelineArtifact[]>(`/api/pipelines/${activePipelineId}/runs/${runId}/artifacts`);
      if (Array.isArray(list)) {
        const grouped: Record<string, PipelineArtifact[]> = {};
        for (const item of list) {
          if (!grouped[item.step_id]) grouped[item.step_id] = [];
          grouped[item.step_id].push(item);
        }
        setArtifacts(grouped);
      }
    } catch {}
  }

  const activePipeline = pipelines.find(p => p.id === activePipelineId) || pipelines[0] || null;

  async function handleRunPipeline() {
    if (!activePipeline) return;
    try {
      setFeedbackMsg(null);
      const res = await apiClient.post<{ runId: string }>(`/api/pipelines/${activePipeline.id}/run`);
      setCurrentRun({
        id: res.runId,
        pipelineId: activePipeline.id,
        status: 'running',
        completedSteps: []
      });
      setFeedbackMsg({ text: `Uruchomiono potok (ID: ${res.runId})` });
    } catch (err: any) {
      setFeedbackMsg({ text: `Błąd startu potoku: ${err.message}`, isError: true });
    }
  }

  async function handleAbortRun() {
    if (!currentRun || !activePipeline) return;
    try {
      await apiClient.delete(`/api/pipelines/${activePipeline.id}/runs/${currentRun.id}`);
      setCurrentRun(prev => prev ? { ...prev, status: 'aborted' } : null);
      setFeedbackMsg({ text: 'Zatrzymano wykonanie potoku.' });
    } catch (err: any) {
      setFeedbackMsg({ text: `Błąd zatrzymania: ${err.message}`, isError: true });
    }
  }

  async function handleApproveStep(stepId: string) {
    if (!currentRun || !activePipeline) return;
    try {
      await apiClient.post(`/api/pipelines/${activePipeline.id}/runs/${currentRun.id}/approve`, { stepId });
      setCurrentRun(prev => prev ? { ...prev, status: 'running', awaitingStepId: undefined } : null);
      setFeedbackMsg({ text: `Zatwierdzono krok "${stepId}"` });
    } catch (err: any) {
      setFeedbackMsg({ text: `Błąd zatwierdzenia: ${err.message}`, isError: true });
    }
  }

  async function handleCreateRelayTemplate() {
    try {
      setFeedbackMsg(null);
      const relaySteps: PipelineStep[] = [
        {
          id: 'step-arch',
          name: 'Architekt Systemu',
          agent: 'claude',
          role: 'Architect',
          prompt: 'Opracuj specyfikację architektury i plan implementacji',
          outputType: 'spec'
        },
        {
          id: 'step-code',
          name: 'Główny Programista',
          agent: 'gemini',
          role: 'Coder',
          prompt: 'Zaimplementuj kod zgodnie ze specyfikacją architekta',
          dependsOn: ['step-arch'],
          outputType: 'code'
        },
        {
          id: 'step-review',
          name: 'Recenzent Kodu',
          agent: 'claude',
          role: 'Reviewer',
          prompt: 'Wykonaj audyt kodu, weryfikację bezpieczeństwa i czystości',
          dependsOn: ['step-code'],
          outputType: 'diff'
        },
        {
          id: 'step-qa',
          name: 'Inżynier QA & Testów',
          agent: 'qwen',
          role: 'QA',
          prompt: 'Uruchom zestaw testów TDD i zweryfikuj pokrycie',
          dependsOn: ['step-review'],
          requireApproval: true,
          outputType: 'test_result'
        },
        {
          id: 'step-devops',
          name: 'Inżynier Wdrożenia DevOps',
          agent: 'gemini',
          role: 'DevOps',
          prompt: 'Zbuduj paczkę i wdróż aplikację na serwer produkcyjny',
          dependsOn: ['step-qa'],
          outputType: 'deploy_log'
        }
      ];

      const newPipeline = await apiClient.post<Pipeline>('/api/pipelines', {
        name: 'Sztafeta Agentów AI (5-Stage)',
        description: 'Architekt ➔ Coder ➔ Reviewer ➔ QA (Human Approval) ➔ DevOps',
        steps: relaySteps
      });

      await fetchPipelines();
      setActivePipelineId(newPipeline.id);
      setFeedbackMsg({ text: 'Załadowano nowy potok sztafety agentów!' });
    } catch (err: any) {
      setFeedbackMsg({ text: `Błąd tworzenia szablonu: ${err.message}`, isError: true });
    }
  }

  function getStepStatus(stepId: string) {
    if (!currentRun) return 'idle';
    if (currentRun.completedSteps?.includes(stepId)) return 'completed';
    if (currentRun.awaitingStepId === stepId) return 'awaiting_approval';
    if (currentRun.currentStepId === stepId) return 'running';
    return 'pending';
  }

  return (
    <div className="pipeline-builder-container p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-5">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-white">
            <Sparkles className="w-6 h-6 text-indigo-400" />
            Orkiestrator Potoków Agentów (DAG Pipeline)
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Wielopoziomowa sztafeta agentów eliminująca context bloat: Architekt ➔ Coder ➔ Reviewer ➔ QA ➔ DevOps
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchPipelines}
            disabled={isLoading}
            className="px-3 py-2 text-sm bg-card/60 hover:bg-card border border-border/60 rounded-lg flex items-center gap-1.5 transition text-foreground"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Odśwież
          </button>
          <button
            onClick={handleCreateRelayTemplate}
            className="px-3 py-2 text-sm bg-indigo-600/80 hover:bg-indigo-600 text-white font-medium rounded-lg flex items-center gap-1.5 transition shadow-sm"
          >
            <Box className="w-4 h-4" />
            Załaduj szablon Sztafety
          </button>
        </div>
      </div>

      {feedbackMsg && (
        <div
          className={`p-3 text-sm rounded-lg border ${
            feedbackMsg.isError
              ? 'bg-red-500/10 border-red-500/30 text-red-300'
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
          }`}
        >
          {feedbackMsg.text}
        </div>
      )}

      {/* Pipeline Selector and Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-3">
          <h3 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
            Dostępne Potoki ({pipelines.length})
          </h3>
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {pipelines.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-border/60 text-center text-sm text-muted-foreground">
                Brak zdefiniowanych potoków. Kliknij „Załaduj szablon Sztafety", aby utworzyć pierwszy.
              </div>
            ) : (
              pipelines.map(pipe => (
                <div
                  key={pipe.id}
                  onClick={() => setActivePipelineId(pipe.id)}
                  className={`p-3 rounded-xl border cursor-pointer transition ${
                    activePipelineId === pipe.id
                      ? 'bg-indigo-950/40 border-indigo-500/60 shadow-md'
                      : 'bg-card/40 hover:bg-card/70 border-border/40'
                  }`}
                >
                  <div className="font-medium text-sm text-foreground">{pipe.name}</div>
                  {pipe.description && (
                    <div className="text-xs text-muted-foreground truncate mt-0.5">{pipe.description}</div>
                  )}
                  <div className="text-[11px] text-muted-foreground/70 mt-2 flex items-center gap-2">
                    <span>{pipe.steps?.length || 0} kroków</span>
                    <span>•</span>
                    <span className="capitalize">{pipe.status || 'idle'}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Pipeline Details and Execution Flow */}
        <div className="lg:col-span-3 space-y-6">
          {activePipeline ? (
            <div className="bg-card/30 border border-border/50 rounded-2xl p-6 backdrop-blur space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/30 pb-4">
                <div>
                  <h2 className="text-lg font-semibold text-white">{activePipeline.name}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">{activePipeline.description}</p>
                </div>

                <div className="flex items-center gap-3">
                  {currentRun?.status === 'running' || currentRun?.status === 'paused' ? (
                    <button
                      onClick={handleAbortRun}
                      className="px-4 py-2 bg-red-600/80 hover:bg-red-600 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition"
                    >
                      <Square className="w-4 h-4 fill-white" />
                      Przerwij potok
                    </button>
                  ) : (
                    <button
                      onClick={handleRunPipeline}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition shadow-sm"
                    >
                      <Play className="w-4 h-4 fill-white" />
                      Uruchom potok
                    </button>
                  )}
                </div>
              </div>

              {/* DAG Timeline / Flow Steps */}
              <div className="space-y-4">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Etapy Sztafety (DAG Sequence)
                </h4>

                <div className="space-y-3">
                  {activePipeline.steps.map((step, idx) => {
                    const status = getStepStatus(step.id);
                    const isAwaiting = status === 'awaiting_approval';
                    const isRunning = status === 'running';
                    const isCompleted = status === 'completed';
                    const stepArtifacts = artifacts[step.id] || [];

                    return (
                      <div
                        key={step.id}
                        className={`p-4 rounded-xl border transition ${
                          isAwaiting
                            ? 'bg-amber-950/30 border-amber-500/60 ring-1 ring-amber-500/40'
                            : isRunning
                            ? 'bg-blue-950/30 border-blue-500/60 ring-1 ring-blue-500/40 animate-pulse'
                            : isCompleted
                            ? 'bg-emerald-950/20 border-emerald-500/40'
                            : 'bg-background/40 border-border/40'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-card/80 border border-border/60 text-xs font-bold text-foreground">
                              {idx + 1}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm text-foreground">{step.name}</span>
                                {step.agent && (
                                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300">
                                    Agent: {step.agent}
                                  </span>
                                )}
                                {step.requireApproval && (
                                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 flex items-center gap-1">
                                    <ShieldAlert className="w-3 h-3" />
                                    Wymaga zatwierdzenia
                                  </span>
                                )}
                              </div>
                              {step.prompt && (
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{step.prompt}</p>
                              )}
                              {step.dependsOn && step.dependsOn.length > 0 && (
                                <div className="text-[11px] text-muted-foreground/80 mt-1 flex items-center gap-1">
                                  <span>Zależy od:</span>
                                  {step.dependsOn.map(dep => (
                                    <span key={dep} className="px-1.5 py-0.2 bg-muted/40 rounded border border-border/40 font-mono text-[10px]">
                                      {dep}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            {/* Status badge */}
                            <div className="flex items-center gap-1.5 text-xs">
                              {isCompleted && (
                                <span className="text-emerald-400 flex items-center gap-1 font-medium">
                                  <CheckCircle className="w-4 h-4" /> Ukończono
                                </span>
                              )}
                              {isRunning && (
                                <span className="text-blue-400 flex items-center gap-1 font-medium">
                                  <RefreshCw className="w-4 h-4 animate-spin" /> W toku
                                </span>
                              )}
                              {isAwaiting && (
                                <span className="text-amber-400 flex items-center gap-1 font-medium">
                                  <AlertTriangle className="w-4 h-4" /> Czeka na decyzję
                                </span>
                              )}
                              {status === 'pending' && (
                                <span className="text-muted-foreground flex items-center gap-1">
                                  <Clock className="w-4 h-4" /> W kolejce
                                </span>
                              )}
                            </div>

                            {/* Human approval button */}
                            {isAwaiting && (
                              <button
                                onClick={() => handleApproveStep(step.id)}
                                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold transition shadow-sm"
                              >
                                Zatwierdź krok
                              </button>
                            )}

                            {stepArtifacts.length > 0 && (
                              <button
                                onClick={() => setExpandedArtifacts(prev => ({ ...prev, [step.id]: !prev[step.id] }))}
                                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                {stepArtifacts.length} artefakt(ów)
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Artifacts expansion */}
                        {expandedArtifacts[step.id] && stepArtifacts.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-border/40 space-y-2">
                            {stepArtifacts.map(art => (
                              <div key={art.id} className="p-2.5 bg-black/40 rounded-lg border border-border/30 text-xs font-mono">
                                <div className="text-indigo-400 font-semibold mb-1">Typ: {art.type}</div>
                                <pre className="whitespace-pre-wrap break-all text-muted-foreground">{art.content}</pre>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-muted-foreground border border-dashed border-border/60 rounded-2xl">
              Wybierz potok z listy po lewej stronie lub utwórz nowy szablon.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PipelineBuilder;
