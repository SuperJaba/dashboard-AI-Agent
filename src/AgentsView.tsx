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
}

export function AgentsView() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newAgent, setNewAgent] = useState({ name: '', description: '', path: '', config_uri: '' });

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

  const handleSaveConfigUri = async (id: number) => {
    try {
      await apiFetch(`/api/agents/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config_uri: editConfigUri })
      });
      setEditingId(null);
      fetchAgents();
    } catch (e) {
      console.error('Failed to save config URI', e);
    }
  };

  const handleDeleteAgent = async (id: number) => {
    if (!confirm('Czy na pewno chcesz usunąć tego agenta?')) return;
    try {
      await apiFetch(`/api/agents/${id}`, { method: 'DELETE' });
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
      setNewAgent({ name: '', description: '', path: '', config_uri: '' });
      fetchAgents();
    } catch (e) {
      console.error('Failed to add agent', e);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-400">Ładowanie agentów...</div>;

  return (
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
        <div className="bg-slate-800 border border-slate-600 p-6 rounded-xl mb-8">
          <h3 className="text-xl text-white mb-4">Dodaj ręcznie Agenta</h3>
          <form onSubmit={handleAddAgent} className="grid grid-cols-2 gap-4">
            <input required placeholder="Nazwa (np. Mój Agent)" value={newAgent.name} onChange={e => setNewAgent({...newAgent, name: e.target.value})} className="bg-slate-900 border border-slate-700 p-2 rounded text-white" />
            <input placeholder="Opis" value={newAgent.description} onChange={e => setNewAgent({...newAgent, description: e.target.value})} className="bg-slate-900 border border-slate-700 p-2 rounded text-white" />
            <input required placeholder="Ścieżka do pliku binarnego (np. /usr/local/bin/agent)" value={newAgent.path} onChange={e => setNewAgent({...newAgent, path: e.target.value})} className="bg-slate-900 border border-slate-700 p-2 rounded text-white" />
            <input placeholder="Config URI (np. /home/user/.agent.json)" value={newAgent.config_uri} onChange={e => setNewAgent({...newAgent, config_uri: e.target.value})} className="bg-slate-900 border border-slate-700 p-2 rounded text-white" />
            <div className="col-span-2 flex justify-end">
              <button type="submit" className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded">Zapisz</button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden backdrop-blur-sm">
        <table className="w-full text-left">
          <thead className="bg-slate-900/50 text-gray-400 text-sm">
            <tr>
              <th className="px-6 py-4 font-medium">Nazwa Agenta</th>
              <th className="px-6 py-4 font-medium">Ścieżka (Binary)</th>
              <th className="px-6 py-4 font-medium">Status</th>
              <th className="px-6 py-4 font-medium">Config URI (Plik ustawień)</th>
              <th className="px-6 py-4 font-medium text-right">Akcje</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {agents.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                  Brak zainstalowanych agentów. Kliknij "Skanuj system", aby wyszukać.
                </td>
              </tr>
            ) : (
              agents.map(agent => (
                <tr key={agent.id} className="hover:bg-slate-800/30 transition">
                  <td className="px-6 py-4">
                    <div className="font-medium text-white">{agent.name}</div>
                    <div className="text-sm text-gray-500">{agent.description}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-400 font-mono">
                    {agent.path}
                  </td>
                  <td className="px-6 py-4">
                    {agent.installed ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                        Zainstalowany
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
                        Brak
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {editingId === agent.id ? (
                      <input 
                        type="text" 
                        value={editConfigUri} 
                        onChange={(e) => setEditConfigUri(e.target.value)}
                        className="bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-sm text-white w-full focus:outline-none focus:border-blue-500"
                        placeholder="/home/seba/.gemini/config.json"
                      />
                    ) : (
                      <span className="text-sm text-gray-400 font-mono">
                        {agent.config_uri || <span className="text-gray-600 italic">Brak (użyj domyślnego)</span>}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right flex justify-end gap-2">
                    {editingId === agent.id ? (
                      <button 
                        onClick={() => handleSaveConfigUri(agent.id)}
                        className="text-green-400 hover:text-green-300 p-1.5 bg-green-400/10 hover:bg-green-400/20 rounded transition"
                        title="Zapisz"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    ) : (
                      <button 
                        onClick={() => {
                          setEditingId(agent.id);
                          setEditConfigUri(agent.config_uri || '');
                        }}
                        className="text-blue-400 hover:text-blue-300 p-1.5 bg-blue-400/10 hover:bg-blue-400/20 rounded transition"
                        title="Edytuj config URI"
                      >
                        <Save className="w-4 h-4" />
                      </button>
                    )}
                    <button 
                      onClick={() => handleDeleteAgent(agent.id)}
                      className="text-red-400 hover:text-red-300 p-1.5 bg-red-400/10 hover:bg-red-400/20 rounded transition"
                      title="Usuń agenta"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
