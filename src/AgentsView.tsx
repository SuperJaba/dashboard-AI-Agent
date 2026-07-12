import React, { useState, useEffect } from 'react';
import { Bot, Search, Save, Check, RefreshCw } from 'lucide-react';
import { apiFetch } from './api';

export interface Agent {
  id: number;
  name: string;
  description: string;
  path: string;
  config_uri: string;
  installed: boolean;
  llm_model?: string;
  temperature?: number;
  max_tokens?: number;
}

export function AgentsView() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [notification, setNotification] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editConfig, setEditConfig] = useState({ config_uri: '', llm_model: '', temperature: 0.7, max_tokens: 4096 });
  const [newAgent, setNewAgent] = useState({ name: '', description: '', path: '', config_uri: '', llm_model: 'gpt-4o', temperature: 0.7, max_tokens: 4096 });
  // Effect to auto-clear notification after 3 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const fetchAgents = async () => {
    try {
      const res = await apiFetch('/api/agents');
      const data = await res.json();
      setAgents(data);
    } catch (e) {
      console.error('Failed to fetch agents', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  const handleScan = async () => {
    setScanning(true);
    try {
      const res = await apiFetch('/api/agents/scan', { method: 'POST' });
      await res.json();
      await fetchAgents();
    } catch (e) {
      console.error('Failed to scan agents', e);
    } finally {
      setScanning(false);
    }
  };

  const handleSaveConfig = async (id: number) => {
    try {
      await apiFetch(`/api/agents/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          config_uri: editConfig.config_uri,
          llm_model: editConfig.llm_model,
          temperature: editConfig.temperature,
          max_tokens: editConfig.max_tokens
        })
      });
      setEditingId(null);
      setNotification('Configuration saved');
      fetchAgents();
    } catch (e) {
      console.error('Failed to save config', e);
    }
  };

  const handleDeleteAgent = async (id: number) => {
    if (!confirm('Czy na pewno chcesz usunąć tego agenta?')) return;
    try {
      await apiFetch(`/api/agents/${id}`, { method: 'DELETE' });
      setNotification('Agent deleted');
      fetchAgents();
    } catch (e) {
      console.error('Failed to delete agent', e);
    }
  };

  const handleAddAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAgent)
      });
      setIsAdding(false);
      setNotification('Agent added');
      setNewAgent({
        name: '',
        description: '',
        path: '',
        config_uri: '',
        llm_model: 'gpt-4o',
        temperature: 0.7,
        max_tokens: 4096
      });
      fetchAgents();
    } catch (e) {
      console.error('Failed to add agent', e);
    }
  };

  if (loading) return (
  <div className="p-8 text-center text-gray-400 flex items-center justify-center" role="status" aria-live="polite">
    <RefreshCw className="w-5 h-5 mr-2 animate-spin" /> Loading agents...
  </div>
);


  return (
    <>
      {notification && (
        <div className="fixed top-4 right-4 bg-emerald-600 text-white px-4 py-2 rounded shadow-lg" role="alert" aria-live="assertive">
          {notification}
        </div>
      )}
      <div className="p-8 max-w-6xl mx-auto">

      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold text-white flex items-center gap-3">
            <Bot className="w-8 h-8 text-blue-400" />
            Lokalni Agenci AI
          </h2>
          <p className="text-gray-400 mt-2">Zarządzaj ustawieniami agentów CLI w systemie.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg flex items-center transition"
          >
            {isAdding ? 'Anuluj' : 'Dodaj Agenta'}
          </button>
          <button
            onClick={handleScan}
            disabled={scanning}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition disabled:opacity-50"
          >
            {scanning ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
            Skanuj system
          </button>
        </div>
      </div>

      {isAdding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 p-8 rounded-2xl shadow-2xl max-w-2xl w-full">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                <Bot className="w-6 h-6 text-blue-400" />
                Dodaj Agenta
              </h3>
              <button onClick={() => setIsAdding(false)} className="text-gray-400 hover:text-white transition">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            <form onSubmit={handleAddAgent} className="grid grid-cols-2 gap-5">
              <div className="space-y-1">
                <label className="text-sm text-gray-400 ml-1">Nazwa Agenta</label>
                <input required placeholder="np. Code Reviewer" value={newAgent.name} onChange={e => setNewAgent({...newAgent, name: e.target.value})} className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition" />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-gray-400 ml-1">Opis (opcjonalnie)</label>
                <input placeholder="np. Sprawdza PR-y" value={newAgent.description} onChange={e => setNewAgent({...newAgent, description: e.target.value})} className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition" />
              </div>
              <div className="space-y-1 col-span-2">
                <label className="text-sm text-gray-400 ml-1">Ścieżka pliku binarnego</label>
                <input required placeholder="np. /usr/local/bin/agent" value={newAgent.path} onChange={e => setNewAgent({...newAgent, path: e.target.value})} className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition font-mono text-sm" />
              </div>
              <div className="space-y-1 col-span-2">
                <label className="text-sm text-gray-400 ml-1">Config URI</label>
                <input placeholder="np. /home/user/.agent.json" value={newAgent.config_uri} onChange={e => setNewAgent({...newAgent, config_uri: e.target.value})} className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition font-mono text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-gray-400 ml-1">Model LLM</label>
                <input placeholder="np. gpt-4o" value={newAgent.llm_model} onChange={e => setNewAgent({...newAgent, llm_model: e.target.value})} className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition" />
              </div>
              <div className="flex gap-4">
                <div className="space-y-1 w-1/2">
                  <label className="text-sm text-gray-400 ml-1">Temperature</label>
                  <input type="number" step="0.1" placeholder="0.7" value={newAgent.temperature} onChange={e => setNewAgent({...newAgent, temperature: parseFloat(e.target.value)})} className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition" />
                </div>
                <div className="space-y-1 w-1/2">
                  <label className="text-sm text-gray-400 ml-1">Max Tokens</label>
                  <input type="number" placeholder="4096" value={newAgent.max_tokens} onChange={e => setNewAgent({...newAgent, max_tokens: parseInt(e.target.value)})} className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition" />
                </div>
              </div>
              <div className="col-span-2 flex justify-end gap-3 mt-4 pt-4 border-t border-slate-800">
                <button type="button" onClick={() => setIsAdding(false)} className="px-5 py-2.5 rounded-xl text-gray-300 hover:bg-slate-800 transition font-medium">Anuluj</button>
                <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl transition font-medium shadow-lg shadow-blue-500/20">Dodaj Agenta</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {agents.length === 0 ? (
          <div className="col-span-full p-12 text-center text-gray-500 bg-slate-800/30 border border-slate-700/50 rounded-2xl">
            <Bot className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-lg">Brak zainstalowanych agentów.</p>
            <p className="text-sm mt-1">Kliknij "Skanuj system", aby wyszukać automatycznie lub dodaj agenta ręcznie.</p>
          </div>
        ) : (
          agents.map(agent => (
            <div key={agent.id} className="bg-slate-800/40 border border-slate-700/80 rounded-2xl p-6 backdrop-blur-sm hover:bg-slate-800/60 transition duration-300 shadow-xl shadow-black/20 flex flex-col h-full">
              
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20 text-blue-400 mt-1">
                    <Bot className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                      {agent.name}
                      {agent.installed ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span> Missing
                        </span>
                      )}
                    </h3>
                    <p className="text-sm text-slate-400 mt-1">{agent.description || 'Brak opisu'}</p>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  {editingId === agent.id ? (
                    <button 
                      onClick={() => handleSaveConfig(agent.id)}
                      className="text-emerald-400 hover:text-emerald-300 p-2 bg-emerald-400/10 hover:bg-emerald-400/20 rounded-lg transition"
                      title="Zapisz"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  ) : (
                    <button 
                      onClick={() => {
                        setEditingId(agent.id);
                        setEditConfig({
                          config_uri: agent.config_uri || '',
                          llm_model: agent.llm_model || 'gpt-4o',
                          temperature: agent.temperature ?? 0.7,
                          max_tokens: agent.max_tokens ?? 4096
                        });
                      }}
                      className="text-blue-400 hover:text-blue-300 p-2 bg-blue-400/10 hover:bg-blue-400/20 rounded-lg transition"
                      title="Edytuj"
                    >
                      <Save className="w-4 h-4" />
                    </button>
                  )}
                  <button 
                    onClick={() => handleDeleteAgent(agent.id)}
                    className="text-rose-400 hover:text-rose-300 p-2 bg-rose-400/10 hover:bg-rose-400/20 rounded-lg transition"
                    title="Usuń"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                  </button>
                </div>
              </div>

              <div className="mt-2 space-y-4 flex-grow">
                <div>
                  <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 mb-1">Ścieżka binarna</div>
                  <div className="bg-slate-900/80 px-3 py-2 rounded-lg border border-slate-800 text-xs text-slate-300 font-mono overflow-x-auto">
                    {agent.path}
                  </div>
                </div>

                <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/50">
                  <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 mb-3">Konfiguracja</div>
                  
                  {editingId === agent.id ? (
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">Config URI</label>
                        <input type="text" value={editConfig.config_uri} onChange={(e) => setEditConfig({...editConfig, config_uri: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition" placeholder="np. ~/.agent.json" />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">LLM Model</label>
                        <input type="text" value={editConfig.llm_model} onChange={(e) => setEditConfig({...editConfig, llm_model: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition" placeholder="gpt-4o" />
                      </div>
                      <div className="flex gap-3">
                        <div className="flex-1">
                          <label className="text-xs text-slate-400 block mb-1">Temp</label>
                          <input type="number" step="0.1" value={editConfig.temperature} onChange={(e) => setEditConfig({...editConfig, temperature: parseFloat(e.target.value)})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition" />
                        </div>
                        <div className="flex-1">
                          <label className="text-xs text-slate-400 block mb-1">Tokens</label>
                          <input type="number" value={editConfig.max_tokens} onChange={(e) => setEditConfig({...editConfig, max_tokens: parseInt(e.target.value)})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-[10px] uppercase text-slate-500 mb-0.5">Model</div>
                        <div className="text-sm font-medium text-blue-300">{agent.llm_model || 'gpt-4o'}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase text-slate-500 mb-0.5">URI</div>
                        <div className="text-sm text-slate-300 font-mono truncate" title={agent.config_uri}>{agent.config_uri || <span className="text-slate-600 italic">Brak</span>}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase text-slate-500 mb-0.5">Temp</div>
                        <div className="text-sm text-slate-300">{agent.temperature ?? 0.7}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase text-slate-500 mb-0.5">Tokens</div>
                        <div className="text-sm text-slate-300">{agent.max_tokens ?? 4096}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

            </div>
          ))
        )}
      </div>
    </div>
</>
  );
}
