import { useState, useEffect, useCallback } from 'react';
import {
  Brain,
  Search,
  Plus,
  Trash2,
  Tag,
  Activity,
  Sparkles,
  RefreshCw,
  Layers,
  X,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { apiClient } from '../shared/api-client';

export interface AgentMemoryItem {
  id: string;
  agent: string;
  project?: string;
  category?: string;
  content: string;
  tags?: string[];
  created_at?: string;
  access_count?: number;
}

interface MemoryNexusPanelProps {
  socket?: any;
}

export function MemoryNexusPanel({ socket }: MemoryNexusPanelProps) {
  const [memories, setMemories] = useState<AgentMemoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [agentFilter, setAgentFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newAgent, setNewAgent] = useState('claude-code');
  const [newProject, setNewProject] = useState('global');
  const [newCategory, setNewCategory] = useState('general');
  const [newContent, setNewContent] = useState('');
  const [newTags, setNewTags] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Status and consolidation state
  const [isConsolidating, setIsConsolidating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError?: boolean } | null>(null);
  const [liveNotification, setLiveNotification] = useState<string | null>(null);

  const fetchMemories = useCallback(async (q?: string, agent?: string, project?: string) => {
    try {
      setIsLoading(true);
      const params: Record<string, string> = {};
      if (q) params.q = q;
      if (agent) params.agent = agent;
      if (project) params.project = project;

      const res = await apiClient.get<AgentMemoryItem[]>('/api/memory', { params });
      setMemories(Array.isArray(res) ? res : []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Błąd podczas pobierania wiedzy';
      setStatusMessage({ text: `Błąd: ${msg}`, isError: true });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMemories();
  }, [fetchMemories]);

  // Live socket listener
  useEffect(() => {
    if (!socket) return;

    const handleMemorySaved = (data: { agent?: string; category?: string; preview?: string }) => {
      setLiveNotification(`Nowa lekcja zarejestrowana [${data.agent || 'agent'}]: ${data.preview || ''}`);
      // Refresh list to keep knowledge fresh
      fetchMemories(searchQuery, agentFilter, projectFilter);
    };

    socket.on('memory:saved', handleMemorySaved);

    return () => {
      socket.off('memory:saved', handleMemorySaved);
    };
  }, [socket, fetchMemories, searchQuery, agentFilter, projectFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchMemories(searchQuery, agentFilter, projectFilter);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setAgentFilter('');
    setProjectFilter('');
    fetchMemories('', '', '');
  };

  const handleCreateLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAgent.trim() || !newContent.trim()) {
      setStatusMessage({ text: 'Agent oraz treść lekcji są wymagane.', isError: true });
      return;
    }

    try {
      setIsSubmitting(true);
      const tagsArray = newTags
        .split(',')
        .map(t => t.trim())
        .filter(Boolean);

      const created = await apiClient.post<AgentMemoryItem>('/api/memory', {
        agent: newAgent.trim(),
        project: newProject.trim() || 'global',
        category: newCategory.trim() || 'general',
        content: newContent.trim(),
        tags: tagsArray
      });

      setMemories(prev => [created, ...prev.filter(m => m.id !== created.id)]);
      setIsModalOpen(false);
      setNewContent('');
      setNewTags('');
      setStatusMessage({ text: 'Lekcja została pomyślnie zapisana w pamięci współdzielonej.' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Błąd podczas zapisywania lekcji';
      setStatusMessage({ text: `Błąd zapisu: ${msg}`, isError: true });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiClient.delete(`/api/memory/${id}`);
      setMemories(prev => prev.filter(m => m.id !== id));
      setStatusMessage({ text: 'Wpis został usunięty z bazy wiedzy.' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Nie udało się usunąć wpisu';
      setStatusMessage({ text: `Błąd usuwania: ${msg}`, isError: true });
    }
  };

  const handleConsolidate = async () => {
    try {
      setIsConsolidating(true);
      const res = await apiClient.post<{ success: boolean; deleted: number }>('/api/memory/consolidate', {
        daysOld: 30,
        minAccessCount: 1
      });
      setStatusMessage({
        text: `Konsolidacja zakończona: usunięto ${res.deleted} wpis(ów) o niskiej aktywności.`
      });
      fetchMemories(searchQuery, agentFilter, projectFilter);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Błąd podczas konsolidacji';
      setStatusMessage({ text: `Błąd konsolidacji: ${msg}`, isError: true });
    } finally {
      setIsConsolidating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-5 rounded-2xl bg-slate-900/90 border border-slate-800 backdrop-blur shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-600/20 text-purple-400 rounded-xl border border-purple-500/30">
            <Brain className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
              Baza Wiedzy Agentów (Cross-Agent Memory Nexus)
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                v1.0 Live
              </span>
            </h2>
            <p className="text-sm text-slate-400">
              Współdzielona pamięć trwała synchronizująca wnioski, uniki przed błędami i konwencje pomiędzy agentami.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleConsolidate}
            disabled={isConsolidating}
            className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-xl transition disabled:opacity-50"
            title="Usuń stare i nieużywane wpisy"
          >
            <Sparkles className="w-4 h-4" />
            {isConsolidating ? 'Konsolidowanie...' : 'Konsolidacja'}
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-xl shadow-lg shadow-purple-600/25 transition active:scale-95"
          >
            <Plus className="w-4 h-4" />
            + Dodaj Lekcję
          </button>
        </div>
      </div>

      {/* Live Notification Banner */}
      {liveNotification && (
        <div className="flex items-center justify-between p-3 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs animate-in fade-in duration-300">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
            <span>{liveNotification}</span>
          </div>
          <button
            onClick={() => setLiveNotification(null)}
            className="text-purple-400 hover:text-white p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Status feedback message */}
      {statusMessage && (
        <div
          className={`flex items-center justify-between p-3 rounded-xl border text-xs ${
            statusMessage.isError
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.isError ? (
              <AlertCircle className="w-4 h-4 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button
            onClick={() => setStatusMessage(null)}
            className="p-1 hover:opacity-80"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
        <div className="relative md:col-span-5">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Szukaj w bazie wiedzy (treść, rozwiązania)..."
            className="w-full pl-10 pr-3 py-2 text-xs bg-slate-900 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500 transition"
          />
        </div>

        <div className="md:col-span-3">
          <input
            type="text"
            value={agentFilter}
            onChange={e => setAgentFilter(e.target.value)}
            placeholder="Filtruj po agencie (np. claude-code)..."
            className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500 transition"
          />
        </div>

        <div className="md:col-span-2">
          <input
            type="text"
            value={projectFilter}
            onChange={e => setProjectFilter(e.target.value)}
            placeholder="Projekt..."
            className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500 transition"
          />
        </div>

        <div className="md:col-span-2 flex items-center gap-1.5">
          <button
            type="submit"
            className="flex-1 px-3 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition"
          >
            Szukaj
          </button>
          <button
            type="button"
            onClick={handleClearSearch}
            className="p-2 text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl transition"
            title="Wyczyść filtry"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>

      {/* Knowledge Cards List */}
      <div className="space-y-3">
        {isLoading && memories.length === 0 ? (
          <div className="flex items-center justify-center p-12 text-slate-500 text-xs">
            <RefreshCw className="w-4 h-4 animate-spin mr-2" />
            Ładowanie bazy wiedzy...
          </div>
        ) : memories.length === 0 ? (
          <div className="text-center p-12 rounded-2xl bg-slate-900/50 border border-slate-800/80 text-slate-400 text-xs">
            <Layers className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="font-medium text-slate-300">Brak zarejestrowanych lekcji</p>
            <p className="text-slate-500 mt-1">Użyj przycisku „+ Dodaj Lekcję”, aby zasilić współdzieloną pamięć agentów.</p>
          </div>
        ) : (
          memories.map(mem => (
            <div
              key={mem.id}
              className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition flex flex-col gap-3 group"
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    {mem.agent}
                  </span>
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                    {mem.category || 'general'}
                  </span>
                  {mem.project && (
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-800/60 text-slate-400 border border-slate-800">
                      {mem.project}
                    </span>
                  )}
                  <span className="text-[11px] flex items-center gap-1 text-slate-400 font-mono">
                    <Activity className="w-3 h-3 text-cyan-400" />
                    Odwołania: {mem.access_count ?? 0}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {mem.created_at && (
                    <span className="text-[10px] text-slate-500">
                      {new Date(mem.created_at).toLocaleDateString()}
                    </span>
                  )}
                  <button
                    onClick={() => handleDelete(mem.id)}
                    title="Usuń wpis"
                    className="p-1 text-slate-500 hover:text-rose-400 opacity-60 group-hover:opacity-100 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="text-xs text-slate-200 leading-relaxed font-mono bg-slate-950/60 p-3 rounded-lg border border-slate-900">
                {mem.content}
              </div>

              {mem.tags && mem.tags.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Tag className="w-3 h-3 text-slate-500" />
                  {mem.tags.map(t => (
                    <span
                      key={t}
                      className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-800/70 text-slate-400 border border-slate-700/50"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Modal - Dodaj Lekcję */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Brain className="w-4 h-4 text-purple-400" />
                Dodaj nową lekcję do bazy wiedzy
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateLesson} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="agent-input" className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Agent *
                  </label>
                  <input
                    id="agent-input"
                    type="text"
                    value={newAgent}
                    onChange={e => setNewAgent(e.target.value)}
                    required
                    placeholder="np. claude-code"
                    className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label htmlFor="project-input" className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Projekt
                  </label>
                  <input
                    id="project-input"
                    type="text"
                    value={newProject}
                    onChange={e => setNewProject(e.target.value)}
                    placeholder="np. dashboard lub global"
                    className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="category-input" className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Kategoria
                </label>
                <input
                  id="category-input"
                  type="text"
                  value={newCategory}
                  onChange={e => setNewCategory(e.target.value)}
                  placeholder="np. database, frontend, security"
                  className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label htmlFor="content-input" className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Treść lekcji *
                </label>
                <textarea
                  id="content-input"
                  value={newContent}
                  onChange={e => setNewContent(e.target.value)}
                  required
                  rows={4}
                  placeholder="Zwięzła, konkretna zasada lub rozwiązanie buga..."
                  className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-purple-500 font-mono"
                />
              </div>

              <div>
                <label htmlFor="tags-input" className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Tagi (rozdzielone przecinkami)
                </label>
                <input
                  id="tags-input"
                  type="text"
                  value={newTags}
                  onChange={e => setNewTags(e.target.value)}
                  placeholder="np. postgres, sql, cache"
                  className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white rounded-xl transition"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-xl shadow-lg shadow-purple-600/25 transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Zapisywanie...' : 'Zapisz lekcję'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default MemoryNexusPanel;
