import React, { useState, useEffect } from 'react';
import { 
  Clock, Play, CheckCircle2, AlertCircle, RefreshCw, 
  Plus, Trash2, Terminal, X, Power, PowerOff, ShieldCheck, 
  FileText, Cpu 
} from 'lucide-react';
import { apiClient } from '../shared/api-client';
import { useDashboardSocket } from '../hooks/useDashboardSocket';

export interface ScheduledTask {
  id: number;
  name: string;
  task_type: string;
  command: string;
  cron_expression: string;
  enabled: boolean;
  last_run: string | null;
  last_status: 'success' | 'failed' | 'running' | 'idle' | string;
  last_output: string | null;
  created_at: string;
  is_running?: boolean;
  has_active_cron?: boolean;
}

export interface TaskPreset {
  type: string;
  name: string;
  description: string;
  defaultCommand: string;
  defaultCron: string;
}

interface AgentSchedulerWidgetProps {
  className?: string;
}

export const AgentSchedulerWidget: React.FC<AgentSchedulerWidgetProps> = ({ className = '' }) => {
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [presets, setPresets] = useState<TaskPreset[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [selectedOutputTask, setSelectedOutputTask] = useState<ScheduledTask | null>(null);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form state
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskType, setNewTaskType] = useState('npm_audit');
  const [newTaskCron, setNewTaskCron] = useState('0 3 * * *');
  const [newTaskCommand, setNewTaskCommand] = useState('npm audit');
  const [newTaskEnabled, setNewTaskEnabled] = useState(true);

  const { socket } = useDashboardSocket();

  const fetchTasks = async () => {
    try {
      const data = await apiClient.get<{ tasks: ScheduledTask[] }>('/api/scheduler/tasks');
      setTasks(data.tasks || []);
    } catch (err: any) {
      console.error('Błąd pobierania zadań harmonogramu:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPresets = async () => {
    try {
      const data = await apiClient.get<{ presets: TaskPreset[] }>('/api/scheduler/presets');
      setPresets(data.presets || []);
    } catch (err: any) {
      console.error('Błąd pobierania szablonów zadań:', err);
    }
  };

  useEffect(() => {
    fetchTasks();
    fetchPresets();
  }, []);

  // Socket updates
  useEffect(() => {
    if (!socket) return;

    const handleTaskStarted = ({ taskId }: { taskId: number }) => {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, last_status: 'running', is_running: true } : t));
    };

    const handleTaskFinished = ({ taskId, status, task }: { taskId: number; status: string; task: ScheduledTask }) => {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...task, last_status: status, is_running: false } : t));
      setActionLoadingId(prev => prev === taskId ? null : prev);
    };

    socket.on('scheduler:task_started', handleTaskStarted);
    socket.on('scheduler:task_finished', handleTaskFinished);

    return () => {
      socket.off('scheduler:task_started', handleTaskStarted);
      socket.off('scheduler:task_finished', handleTaskFinished);
    };
  }, [socket]);

  const handleRunNow = async (taskId: number) => {
    setActionLoadingId(taskId);
    setErrorMsg(null);
    try {
      await apiClient.post(`/api/scheduler/tasks/${taskId}/run`);
      await fetchTasks();
    } catch (err: any) {
      setErrorMsg(err.message || 'Nie udało się uruchomić zadania.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleToggle = async (taskId: number, currentEnabled: boolean) => {
    try {
      await apiClient.patch(`/api/scheduler/tasks/${taskId}/toggle`, { enabled: !currentEnabled });
      await fetchTasks();
    } catch (err: any) {
      setErrorMsg(err.message || 'Nie udało się zmienić stanu zadania.');
    }
  };

  const handleDelete = async (taskId: number) => {
    if (!window.confirm('Czy na pewno chcesz usunąć to zaplanowane zadanie?')) {
      return;
    }
    try {
      await apiClient.delete(`/api/scheduler/tasks/${taskId}`);
      await fetchTasks();
    } catch (err: any) {
      setErrorMsg(err.message || 'Nie udało się usunąć zadania.');
    }
  };

  const handleSelectPreset = (type: string) => {
    setNewTaskType(type);
    const preset = presets.find(p => p.type === type);
    if (preset) {
      setNewTaskName(preset.name);
      setNewTaskCron(preset.defaultCron);
      setNewTaskCommand(preset.defaultCommand);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      await apiClient.post('/api/scheduler/tasks', {
        name: newTaskName,
        task_type: newTaskType,
        command: newTaskCommand,
        cron_expression: newTaskCron,
        enabled: newTaskEnabled
      });
      setShowAddModal(false);
      resetForm();
      await fetchTasks();
    } catch (err: any) {
      setErrorMsg(err.message || 'Błąd podczas tworzenia zadania.');
    }
  };

  const resetForm = () => {
    setNewTaskName('');
    setNewTaskType('npm_audit');
    setNewTaskCron('0 3 * * *');
    setNewTaskCommand('npm audit');
    setNewTaskEnabled(true);
  };

  const formatLastRun = (dateStr: string | null) => {
    if (!dateStr) return 'Nigdy nie uruchamiano';
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('pl-PL', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  const getStatusBadge = (task: ScheduledTask) => {
    if (task.is_running || task.last_status === 'running') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
          <RefreshCw className="w-3 h-3 animate-spin" />
          Wykonywanie...
        </span>
      );
    }
    if (task.last_status === 'success') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <CheckCircle2 className="w-3 h-3" />
          Sukces
        </span>
      );
    }
    if (task.last_status === 'failed') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
          <AlertCircle className="w-3 h-3" />
          Błąd
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
        Oczekuje
      </span>
    );
  };

  const getTaskIcon = (taskType: string) => {
    switch (taskType) {
      case 'npm_audit':
        return <ShieldCheck className="w-4 h-4 text-emerald-400" />;
      case 'error_check':
        return <AlertCircle className="w-4 h-4 text-amber-400" />;
      case 'sync_tasks':
        return <FileText className="w-4 h-4 text-cyan-400" />;
      default:
        return <Cpu className="w-4 h-4 text-purple-400" />;
    }
  };

  return (
    <div className={`bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg relative ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-100 text-sm tracking-wide">
              Harmonogram Zadań Agentów (Cron)
            </h3>
            <p className="text-xs text-slate-400">
              Cykliczne audyty bezpieczeństwa, synchronizacja i zadania AI
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchTasks()}
            disabled={loading}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title="Odśwież listę zadań"
            aria-label="Odśwież zadania"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-all shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            Dodaj zadanie
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="mb-4 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center justify-between">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="text-rose-400 hover:text-rose-200">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Task List */}
      <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
        {tasks.length === 0 && !loading && (
          <div className="text-center py-8 text-slate-500 text-xs border border-dashed border-slate-800 rounded-lg">
            Brak zdefiniowanych zadań harmonogramu. Kliknij "Dodaj zadanie", aby utworzyć pierwsze.
          </div>
        )}

        {tasks.map(task => (
          <div 
            key={task.id}
            className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3 hover:border-slate-700/80 transition-all flex flex-col gap-2"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <div className="p-1 rounded bg-slate-800/60">
                  {getTaskIcon(task.task_type)}
                </div>
                <div className="truncate">
                  <span className="font-medium text-slate-200 text-xs truncate block" title={task.name}>
                    {task.name}
                  </span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700/50">
                      {task.cron_expression}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Ostatnio: {formatLastRun(task.last_run)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {getStatusBadge(task)}

                <button
                  onClick={() => handleToggle(task.id, task.enabled)}
                  className={`p-1.5 rounded-md transition-colors ${
                    task.enabled 
                      ? 'text-emerald-400 hover:bg-emerald-500/10' 
                      : 'text-slate-500 hover:bg-slate-800'
                  }`}
                  title={task.enabled ? 'Aktywne (kliknij, aby wstrzymać)' : 'Wstrzymane (kliknij, aby włączyć)'}
                >
                  {task.enabled ? <Power className="w-3.5 h-3.5" /> : <PowerOff className="w-3.5 h-3.5" />}
                </button>

                <button
                  onClick={() => handleRunNow(task.id)}
                  disabled={actionLoadingId === task.id || task.is_running}
                  className="p-1.5 rounded-md bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 transition-colors disabled:opacity-50"
                  title="Uruchom teraz"
                >
                  <Play className={`w-3.5 h-3.5 ${actionLoadingId === task.id ? 'animate-pulse' : ''}`} />
                </button>

                {task.last_output && (
                  <button
                    onClick={() => setSelectedOutputTask(task)}
                    className="p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                    title="Pokaż log wyjścia"
                  >
                    <Terminal className="w-3.5 h-3.5" />
                  </button>
                )}

                <button
                  onClick={() => handleDelete(task.id)}
                  className="p-1.5 rounded-md text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                  title="Usuń zadanie"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal: Logi zadania */}
      {selectedOutputTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full p-5 shadow-2xl flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-indigo-400" />
                <h4 className="font-semibold text-slate-100 text-sm">
                  Log wyjścia: {selectedOutputTask.name}
                </h4>
              </div>
              <button
                onClick={() => setSelectedOutputTask(null)}
                className="text-slate-400 hover:text-slate-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-3 flex-1 overflow-auto bg-slate-950 p-3 rounded-lg border border-slate-800/80 font-mono text-xs text-slate-300 whitespace-pre-wrap">
              {selectedOutputTask.last_output || 'Brak danych wyjściowych.'}
            </div>

            <div className="mt-3 pt-3 border-t border-slate-800 flex justify-between items-center text-xs text-slate-500">
              <span>Status: {selectedOutputTask.last_status}</span>
              <button
                onClick={() => setSelectedOutputTask(null)}
                className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium"
              >
                Zamknij
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Dodaj nowe zadanie */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-400" />
                <h4 className="font-semibold text-slate-100 text-sm">
                  Dodaj nowe zadanie harmonogramu
                </h4>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="mt-4 space-y-3.5">
              {/* Presets selector */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Wybierz szablon zadania:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {presets.map(p => (
                    <button
                      key={p.type}
                      type="button"
                      onClick={() => handleSelectPreset(p.type)}
                      className={`text-left p-2.5 rounded-lg border text-xs transition-all ${
                        newTaskType === p.type
                          ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300'
                          : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <span className="font-medium block text-slate-200">{p.name}</span>
                      <span className="text-[10px] text-slate-500 truncate block mt-0.5">{p.description}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Nazwa zadania:
                </label>
                <input
                  type="text"
                  required
                  value={newTaskName}
                  onChange={e => setNewTaskName(e.target.value)}
                  placeholder="np. Nocny audyt bezpieczeństwa"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Harmonogram Cron:
                  </label>
                  <input
                    type="text"
                    required
                    value={newTaskCron}
                    onChange={e => setNewTaskCron(e.target.value)}
                    placeholder="np. 0 3 * * *"
                    className="w-full font-mono bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                  <span className="text-[10px] text-slate-500 block mt-0.5">np. 0 3 * * * (03:00 codziennie)</span>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Typ zadania:
                  </label>
                  <select
                    value={newTaskType}
                    onChange={e => handleSelectPreset(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="npm_audit">Audyt bezpieczeństwa (npm audit)</option>
                    <option value="error_check">Weryfikacja logów</option>
                    <option value="sync_tasks">Synchronizacja zadań</option>
                    <option value="custom_command">Własna komenda powłoki</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Polecenie do wykonania:
                </label>
                <input
                  type="text"
                  value={newTaskCommand}
                  onChange={e => setNewTaskCommand(e.target.value)}
                  placeholder="npm audit lub node script.js"
                  className="w-full font-mono bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="taskEnabled"
                  checked={newTaskEnabled}
                  onChange={e => setNewTaskEnabled(e.target.checked)}
                  className="rounded bg-slate-950 border-slate-800 text-indigo-600 focus:ring-0"
                />
                <label htmlFor="taskEnabled" className="text-xs text-slate-300">
                  Włącz zadanie natychmiast po zapisaniu
                </label>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium"
                >
                  Zapisz zadanie
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
