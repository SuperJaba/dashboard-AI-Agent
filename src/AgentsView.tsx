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
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editConfigUri, setEditConfigUri] = useState('');

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
        <button
          onClick={handleScan}
          disabled={scanning}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition disabled:opacity-50"
        >
          {scanning ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
          Skanuj system
        </button>
      </div>

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
                  <td className="px-6 py-4 text-right">
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
