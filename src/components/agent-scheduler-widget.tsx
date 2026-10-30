import React, { useState, useEffect } from 'react';
import { 
  Clock, Play, CheckCircle2, AlertCircle, RefreshCw, 
  Plus, Trash2, Terminal, X, Power, PowerOff, ShieldCheck, 
<<<<<<< HEAD
  FileText, Cpu, Pencil 
=======
  FileText, Cpu, Edit2 
>>>>>>> 459cbfdc07f71aa09b3dcc5f3782effcd36d81af
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
  const [editingTask, setEditingTask] = useState<ScheduledTask | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form state
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskType, setNewTaskType] = useState('npm_audit');
  const [newTaskCron, setNewTaskCron] = useState('0 3 * * *');
  const [newTaskCommand, setNewTaskCommand] = useState('npm audit');
  const [newTaskEnabled, setNewTaskEnabled] = useState(true);

  // Edit form state
  const [editingTask, setEditingTask] = useState<ScheduledTask | null>(null);
  const [editTaskName, setEditTaskName] = useState('');
  const [editTaskType, setEditTaskType] = useState('npm_audit');
  const [editTaskCron, setEditTaskCron] = useState('0 3 * * *');
  const [editTaskCommand, setEditTaskCommand] = useState('');
  const [editTaskEnabled, setEditTaskEnabled] = useState(true);

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

  const handleEditTask = (task: ScheduledTask) => {
    setEditingTask(task);
    setNewTaskName(task.name);
    setNewTaskType(task.task_type);
    setNewTaskCron(task.cron_expression);
    setNewTaskCommand(task.command);
    setNewTaskEnabled(task.enabled);
    setShowAddModal(true);
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      if (editingTask) {
        await apiClient.put(`/api/scheduler/tasks/${editingTask.id}`, {
          name: newTaskName,
          task_type: newTaskType,
          command: newTaskCommand,
          cron_expression: newTaskCron,
          enabled: newTaskEnabled
        });
      } else {
        await apiClient.post('/api/scheduler/tasks', {
          name: newTaskName,
          task_type: newTaskType,
          command: newTaskCommand,
          cron_expression: newTaskCron,
          enabled: newTaskEnabled
        });
      }
      setShowAddModal(false);
      resetForm();
      await fetchTasks();
    } catch (err: any) {
      setErrorMsg(err.message || (editingTask ? 'Błąd podczas edycji zadania.' : 'Błąd podczas tworzenia zadania.'));
    }
  };

  const handleStartEdit = (task: ScheduledTask) => {
    setEditingTask(task);
    setEditTaskName(task.name);
    setEditTaskType(task.task_type || 'custom_command');
    setEditTaskCron(task.cron_expression);
    setEditTaskCommand(task.command || '');
    setEditTaskEnabled(task.enabled);
    setErrorMsg(null);
  };

  const handleUpdateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask) return;
    setErrorMsg(null);
    try {
      await apiClient.put(`/api/scheduler/tasks/${editingTask.id}`, {
        name: editTaskName,
        task_type: editTaskType,
        command: editTaskCommand,
        cron_expression: editTaskCron,
        enabled: editTaskEnabled
      });
      setEditingTask(null);
      await fetchTasks();
    } catch (err: any) {
      setErrorMsg(err.message || 'Błąd podczas aktualizacji zadania.');
    }
  };

  const resetForm = () => {
    setEditingTask(null);
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
      case 'omv_audit':
        return <Terminal className="w-4 h-4 text-emerald-400" />;
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
    <div className={`bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-md text-white relative transition-colors hover:border-slate-700 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-800">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 text-indigo-400 shadow-inner">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-100 text-lg tracking-tight">
              Harmonogram Zadań Agentów (Cron)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Cykliczne audyty bezpieczeństwa, synchronizacja i zadania AI
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => fetchTasks()}
            disabled={loading}
            className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-white rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 transition-colors disabled:opacity-50 cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-500"
            title="Odśwież listę zadań"
            aria-label="Odśwież zadania"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowAddModal(true)}
<<<<<<< HEAD
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors shadow-md hover:shadow-indigo-500/20 cursor-pointer active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-indigo-500"
=======
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors shadow-sm"
>>>>>>> 459cbfdc07f71aa09b3dcc5f3782effcd36d81af
          >
            <Plus className="w-4 h-4" />
            Dodaj zadanie
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center justify-between">
          <span>{errorMsg}</span>
          <button 
            onClick={() => setErrorMsg(null)} 
            className="text-rose-400 hover:text-rose-200 p-1 rounded-md"
            aria-label="Zamknij powiadomienie"
          >
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
            className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3 hover:border-slate-700/80 transition-colors flex flex-col gap-2"
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
                    aria-label="Pokaż log wyjścia"
                  >
                    <Terminal className="w-3.5 h-3.5" />
                  </button>
                )}

                <button
<<<<<<< HEAD
                  onClick={() => handleEditTask(task)}
                  className="p-1.5 rounded-md text-slate-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors cursor-pointer"
                  title="Edytuj zadanie"
                  aria-label="Edytuj zadanie"
                >
                  <Pencil className="w-3.5 h-3.5" />
=======
                  onClick={() => handleStartEdit(task)}
                  className="p-1.5 rounded-md text-slate-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors"
                  title="Edytuj zadanie"
                  aria-label={`Edytuj zadanie ${task.name}`}
                >
                  <Edit2 className="w-3.5 h-3.5" />
>>>>>>> 459cbfdc07f71aa09b3dcc5f3782effcd36d81af
                </button>

                <button
                  onClick={() => handleDelete(task.id)}
                  className="p-1.5 rounded-md text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                  title="Usuń zadanie"
                  aria-label="Usuń zadanie"
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
        <div 
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-task-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 bg-black/75 backdrop-blur-md overscroll-contain animate-in fade-in duration-150"
        >
          <div className="bg-slate-950 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 md:p-7 shadow-2xl overflow-y-auto max-h-[92vh] text-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h4 id="add-task-modal-title" className="font-semibold text-slate-100 text-base">
                    {editingTask ? 'Edytuj zadanie harmonogramu' : 'Dodaj nowe zadanie harmonogramu'}
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {editingTask ? 'Zaktualizuj parametry zadania, polecenie lub regułę cron' : 'Skonfiguruj cykliczne zadanie powłoki, audytu lub diagnostyki'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => { setShowAddModal(false); resetForm(); }}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                aria-label="Zamknij formularz"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="mt-5 space-y-4">
              {/* Presets selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  Wybierz gotowy szablon zadania:
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {presets.map(p => (
                    <button
                      key={p.type}
                      type="button"
                      onClick={() => handleSelectPreset(p.type)}
<<<<<<< HEAD
                      className={`text-left p-3 rounded-xl border text-xs transition-colors cursor-pointer ${
=======
                      className={`text-left p-2.5 rounded-lg border text-xs transition-colors ${
>>>>>>> 459cbfdc07f71aa09b3dcc5f3782effcd36d81af
                        newTaskType === p.type
                          ? 'border-indigo-500 bg-indigo-500/15 text-indigo-200 shadow-sm ring-1 ring-indigo-500/50'
                          : 'border-slate-800/90 bg-slate-900/60 text-slate-300 hover:border-slate-700 hover:bg-slate-900'
                      }`}
                    >
                      <span className="font-semibold block text-slate-100 text-xs tracking-tight">{p.name}</span>
                      <span className="text-[11px] text-slate-400 block mt-1 leading-snug line-clamp-2">{p.description}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="newTaskName" className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Nazwa zadania:
                </label>
                <input
                  id="newTaskName"
                  name="name"
                  type="text"
                  name="newTaskName"
                  autoComplete="off"
                  required
                  value={newTaskName}
                  onChange={e => setNewTaskName(e.target.value)}
<<<<<<< HEAD
                  placeholder="np. Nocny audyt bezpieczeństwa…"
                  autoComplete="off"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
=======
                  placeholder="np. Nocny audyt bezpieczeństwa"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 focus-visible:border-indigo-500"
>>>>>>> 459cbfdc07f71aa09b3dcc5f3782effcd36d81af
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div>
                  <label htmlFor="newTaskCron" className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Harmonogram Cron:
                  </label>
                  <input
                    id="newTaskCron"
                    name="cron"
                    type="text"
                    name="newTaskCron"
                    autoComplete="off"
                    required
                    value={newTaskCron}
                    onChange={e => setNewTaskCron(e.target.value)}
<<<<<<< HEAD
                    placeholder="np. 0 3 * * *…"
                    spellCheck={false}
                    autoComplete="off"
                    className="w-full font-mono bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
=======
                    placeholder="np. 0 3 * * *"
                    className="w-full font-mono bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 focus-visible:border-indigo-500"
>>>>>>> 459cbfdc07f71aa09b3dcc5f3782effcd36d81af
                  />
                  <span className="text-[11px] text-slate-500 block mt-1 font-mono">
                    np. 0 3 * * * (codziennie o 03:00 w nocy)
                  </span>
                </div>

                <div>
                  <label htmlFor="newTaskType" className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Typ zadania:
                  </label>
                  <select
                    id="newTaskType"
                    name="type"
                    value={newTaskType}
                    onChange={e => handleSelectPreset(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors cursor-pointer"
                  >
                    <option value="omv_audit">Nocny audyt OMV (SMART + logi)</option>
                    <option value="npm_audit">Audyt bezpieczeństwa (npm audit)</option>
                    <option value="error_check">Weryfikacja logów aplikacji</option>
                    <option value="sync_tasks">Synchronizacja zadań (tasks.md)</option>
                    <option value="custom_command">Własna komenda powłoki (SSH / Bash)</option>
                  </select>
                </div>
              </div>

              <div>
<<<<<<< HEAD
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="newTaskCommand" className="text-xs font-semibold text-slate-300">
                    Polecenie do wykonania:
                  </label>
                  <span className="text-[11px] text-slate-500 font-mono">
                    Bash / SSH jednolinijkowiec
                  </span>
                </div>
                <textarea
                  id="newTaskCommand"
                  name="command"
                  rows={4}
                  value={newTaskCommand}
                  onChange={e => setNewTaskCommand(e.target.value)}
                  placeholder="np. npm audit lub komenda SSH z badaniem logów…"
                  spellCheck={false}
                  autoComplete="off"
                  className="w-full font-mono bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-xs md:text-sm text-emerald-300 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 leading-relaxed resize-y min-h-[105px] transition-colors"
=======
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Polecenie do wykonania:
                </label>
                <input
                  type="text"
                  name="newTaskCommand"
                  autoComplete="off"
                  spellCheck={false}
                  value={newTaskCommand}
                  onChange={e => setNewTaskCommand(e.target.value)}
                  placeholder="npm audit lub node script.js"
                  className="w-full font-mono bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 focus-visible:border-indigo-500"
>>>>>>> 459cbfdc07f71aa09b3dcc5f3782effcd36d81af
                />
              </div>

              <div className="pt-1">
                <label 
                  htmlFor="taskEnabled" 
                  className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-900/60 cursor-pointer select-none transition-colors border border-transparent hover:border-slate-800"
                >
                  <input
                    type="checkbox"
                    id="taskEnabled"
                    checked={newTaskEnabled}
                    onChange={e => setNewTaskEnabled(e.target.checked)}
                    className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span className="text-xs text-slate-300 font-medium">
                    Włącz zadanie w harmonogramie natychmiast po zapisaniu
                  </span>
                </label>
              </div>

              <div className="pt-4 border-t border-slate-800/80 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => { setShowAddModal(false); resetForm(); }}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors shadow-md hover:shadow-indigo-500/20 cursor-pointer active:scale-[0.99]"
                >
                  {editingTask ? 'Zapisz zmiany' : 'Zapisz zadanie'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edytuj zadanie */}
      {editingTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-indigo-400" />
                <h4 className="font-semibold text-slate-100 text-sm">
                  Edytuj zadanie harmonogramu
                </h4>
              </div>
              <button
                onClick={() => setEditingTask(null)}
                className="text-slate-400 hover:text-slate-200 transition-colors"
                aria-label="Zamknij edycję"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateTask} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Nazwa zadania:
                </label>
                <input
                  type="text"
                  name="editTaskName"
                  autoComplete="off"
                  required
                  value={editTaskName}
                  onChange={e => setEditTaskName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 focus-visible:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Harmonogram Cron:
                  </label>
                  <input
                    type="text"
                    name="editTaskCron"
                    autoComplete="off"
                    required
                    value={editTaskCron}
                    onChange={e => setNewTaskCron(e.target.value)}
                    placeholder="np. 0 3 * * *"
                    className="w-full font-mono bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 focus-visible:border-indigo-500"
                  />
                  <span className="text-[10px] text-slate-500 block mt-0.5">np. 0 3 * * * (03:00 codziennie)</span>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Typ zadania:
                  </label>
                  <select
                    value={editTaskType}
                    onChange={e => setEditTaskType(e.target.value)}
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
                  name="editTaskCommand"
                  autoComplete="off"
                  spellCheck={false}
                  value={editTaskCommand}
                  onChange={e => setEditTaskCommand(e.target.value)}
                  placeholder="npm audit lub node script.js"
                  className="w-full font-mono bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 focus-visible:border-indigo-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="editTaskEnabled"
                  checked={editTaskEnabled}
                  onChange={e => setEditTaskEnabled(e.target.checked)}
                  className="rounded bg-slate-950 border-slate-800 text-indigo-600 focus:ring-0"
                />
                <label htmlFor="editTaskEnabled" className="text-xs text-slate-300">
                  Zadanie aktywne (włączone w harmonogramie)
                </label>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingTask(null)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium"
                >
                  Zapisz zmiany
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
