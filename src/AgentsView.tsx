import React, { useState, useEffect } from 'react';
import { 
  Bot, Search, Check, RefreshCw, Sparkles, 
  Sliders, Settings, Info, Gauge, Zap, Trash2, X
} from 'lucide-react';
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

interface LLMTuningResult {
  status: string;
  llmUrl: string;
  type: string;
  latency: number | null;
  speed: number | null;
  recommendations: string[];
}

export function AgentsView() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [notification, setNotification] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  
  // Tuning states
  const [tuningAgentId, setTuningAgentId] = useState<number | null>(null);
  const [tuningLLM, setTuningLLM] = useState(false);
  const [llmTuneResult, setLlmTuneResult] = useState<LLMTuningResult | null>(null);
  const [showLLMModal, setShowLLMModal] = useState(false);

  const [editConfig, setEditConfig] = useState({ config_uri: '', llm_model: '', temperature: 0.7, max_tokens: 4096 });
  const [newAgent, setNewAgent] = useState({ name: '', description: '', path: '', config_uri: '', llm_model: 'gpt-4o', temperature: 0.7, max_tokens: 4096 });
  
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
      setNotification('System scan completed');
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

  const handleAutoTuneAgent = async (id: number) => {
    setTuningAgentId(id);
    try {
      const res = await apiFetch(`/api/agents/${id}/tune`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setNotification(`Auto-tuned: ${data.agent.name}`);
        fetchAgents();
      }
    } catch (e) {
      console.error('Failed to auto-tune agent', e);
    } finally {
      setTuningAgentId(null);
    }
  };

  const handleAutoTuneLLM = async () => {
    setTuningLLM(true);
    setLlmTuneResult(null);
    setShowLLMModal(true);
    try {
      const res = await apiFetch('/api/settings/llm/tune', { method: 'POST' });
      const data = await res.json();
      setLlmTuneResult(data);
    } catch (e) {
      console.error('Failed to auto-tune LLM', e);
    } finally {
      setTuningLLM(false);
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
    <div className="p-8 text-center flex flex-col gap-3 items-center justify-center min-h-[50vh]" role="status" aria-live="polite">
      <RefreshCw className="w-8 h-8 animate-spin" style={{ color: 'var(--primary)' }} /> 
      <span className="font-semibold" style={{ color: 'var(--text-muted)' }}>Wyszukiwanie agentów...</span>
    </div>
  );

  return (
    <>
      {notification && (
        <div 
          className="fixed top-4 right-4 z-50 bg-emerald-600 border border-emerald-500 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 animate-in fade-in duration-300" 
          role="alert" 
          aria-live="assertive"
        >
          <Check className="w-5 h-5 text-emerald-100" />
          <span className="font-semibold text-sm">{notification}</span>
        </div>
      )}
      
      <div className="p-8 max-w-6xl mx-auto">
        {/* Title and Top Panel */}
        <header className="header animate-in delay-1" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1.5rem', marginBottom: '2rem' }}>
          <div>
            <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.875rem' }}>
              <Bot size={28} color="var(--primary)" style={{ filter: 'drop-shadow(0 0 8px rgba(79,70,229,0.4))' }} />
              Lokalni Agenci AI
            </h1>
            <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem', fontSize: '0.875rem' }}>
              Zarządzaj konfiguracją CLI lokalnych agentów AI oraz optymalizuj parametry ich modeli.
            </p>
          </div>
          
          <div className="agents-actions">
            <button
              onClick={handleAutoTuneLLM}
              className="btn btn-tune"
            >
              <Gauge size={16} />
              Strojenie LLM Server
            </button>
            
            <button
              onClick={() => setIsAdding(!isAdding)}
              className="btn btn-secondary"
            >
              {isAdding ? 'Anuluj' : 'Dodaj Agenta'}
            </button>
            
            <button
              onClick={handleScan}
              disabled={scanning}
              className="btn btn-primary"
            >
              {scanning ? <RefreshCw size={16} className="animate-spin" /> : <Search size={16} />}
              Skanuj system
            </button>
          </div>
        </header>

        {/* Add Agent Modal Overlay */}
        {isAdding && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
            <div className="glass-card max-w-xl w-full p-8 border border-white/10" style={{ position: 'relative' }}>
              <button 
                onClick={() => setIsAdding(false)} 
                className="absolute top-4 right-4 p-1.5 bg-slate-800/40 border border-slate-700/50 rounded-lg text-gray-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
              
              <h3 className="text-2xl font-bold text-white flex items-center gap-2.5 mb-6" style={{ fontFamily: 'Outfit, sans-serif' }}>
                <Bot className="w-6 h-6 text-blue-400" />
                Dodaj Nowego Agenta
              </h3>
              
              <form onSubmit={handleAddAgent} className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Nazwa Agenta</label>
                  <input required placeholder="np. Code Reviewer" value={newAgent.name} onChange={e => setNewAgent({...newAgent, name: e.target.value})} className="w-full bg-slate-950/80 border border-slate-800 p-2.5 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Opis</label>
                  <input placeholder="np. Sprawdza PR-y" value={newAgent.description} onChange={e => setNewAgent({...newAgent, description: e.target.value})} className="w-full bg-slate-950/80 border border-slate-800 p-2.5 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition" />
                </div>
                <div className="space-y-1 col-span-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Ścieżka pliku binarnego (Path)</label>
                  <input required placeholder="np. /usr/local/bin/agent" value={newAgent.path} onChange={e => setNewAgent({...newAgent, path: e.target.value})} className="w-full bg-slate-950/80 border border-slate-800 p-2.5 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition font-mono text-xs" />
                </div>
                <div className="space-y-1 col-span-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Config URI</label>
                  <input placeholder="np. /home/user/.agent.json" value={newAgent.config_uri} onChange={e => setNewAgent({...newAgent, config_uri: e.target.value})} className="w-full bg-slate-950/80 border border-slate-800 p-2.5 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition font-mono text-xs" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Model LLM</label>
                  <input placeholder="np. gpt-4o" value={newAgent.llm_model} onChange={e => setNewAgent({...newAgent, llm_model: e.target.value})} className="w-full bg-slate-950/80 border border-slate-800 p-2.5 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition" />
                </div>
                <div className="flex gap-3">
                  <div className="space-y-1 w-1/2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Temp</label>
                    <input type="number" step="0.1" placeholder="0.7" value={newAgent.temperature} onChange={e => setNewAgent({...newAgent, temperature: parseFloat(e.target.value)})} className="w-full bg-slate-950/80 border border-slate-800 p-2.5 rounded-xl text-white text-sm focus:outline-none" />
                  </div>
                  <div className="space-y-1 w-1/2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Tokens</label>
                    <input type="number" placeholder="4096" value={newAgent.max_tokens} onChange={e => setNewAgent({...newAgent, max_tokens: parseInt(e.target.value)})} className="w-full bg-slate-950/80 border border-slate-800 p-2.5 rounded-xl text-white text-sm focus:outline-none" />
                  </div>
                </div>
                <div className="col-span-2 flex justify-end gap-3 mt-6 pt-4 border-t border-slate-800">
                  <button type="button" onClick={() => setIsAdding(false)} className="transition text-sm font-semibold" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.5rem 1rem' }}>Anuluj</button>
                  <button type="submit" className="btn btn-primary text-sm" style={{ padding: '0.5rem 1.25rem', borderRadius: '12px' }}>Dodaj Agenta</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Agents Grid */}
        <div className="agents-grid">
          {agents.length === 0 ? (
            <div className="col-span-full p-12 text-center text-gray-500 bg-slate-850/40 border border-slate-800/80 rounded-2xl">
              <Bot className="w-14 h-14 text-slate-600 mx-auto mb-4" />
              <p className="text-lg font-semibold text-slate-300">Brak zainstalowanych agentów</p>
              <p className="text-sm text-slate-500 mt-1">Użyj "Skanuj system" w prawym górnym rogu lub kliknij "Dodaj Agenta".</p>
            </div>
          ) : (
            agents.map(agent => {
              const isTuning = tuningAgentId === agent.id;
              
              return (
                <div key={agent.id} className="glass-card agent-card">
                  {/* Top row */}
                  <div>
                    <div className="agent-header">
                      <div className="agent-title-block">
                        <div className="agent-icon-wrapper">
                          <Bot size={20} />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            {agent.name}
                            {agent.installed ? (
                              <span className="agent-badge agent-badge-active">
                                Active
                              </span>
                            ) : (
                              <span className="agent-badge agent-badge-missing">
                                Missing
                              </span>
                            )}
                          </h3>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{agent.description || 'Brak opisu'}</p>
                        </div>
                      </div>
                      
                      {/* Action buttons */}
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => handleAutoTuneAgent(agent.id)}
                          disabled={isTuning}
                          className={`p-2 rounded-lg transition text-slate-400 hover:text-purple-400 bg-purple-500/5 border border-purple-500/10 hover:bg-purple-500/10 ${isTuning ? 'opacity-50 cursor-not-allowed' : ''}`}
                          title="Auto-Tune Agent Parameters"
                          style={{ cursor: 'pointer' }}
                        >
                          <Sparkles className={`w-4 h-4 ${isTuning ? 'animate-bounce text-purple-400' : ''}`} />
                        </button>
                        
                        {editingId === agent.id ? (
                          <button 
                            onClick={() => handleSaveConfig(agent.id)}
                            className="text-emerald-400 hover:text-emerald-300 p-2 bg-emerald-400/10 hover:bg-emerald-400/20 border border-emerald-500/10 rounded-lg transition"
                            title="Zapisz"
                            style={{ cursor: 'pointer' }}
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
                            className="text-blue-400 hover:text-blue-300 p-2 bg-blue-400/10 hover:bg-blue-400/20 border border-blue-500/10 rounded-lg transition"
                            title="Edytuj"
                            style={{ cursor: 'pointer' }}
                          >
                            <Settings className="w-4 h-4" />
                          </button>
                        )}
                        <button 
                          onClick={() => handleDeleteAgent(agent.id)}
                          className="text-rose-400 hover:text-rose-350 p-2 bg-rose-500/5 hover:bg-rose-500/10 border border-rose-500/10 rounded-lg transition"
                          title="Usuń"
                          style={{ cursor: 'pointer' }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Binary Path Info */}
                    <div style={{ marginTop: '1rem', marginBottom: '1.5rem' }}>
                      <div className="info-label" style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}>Ścieżka binarna</div>
                      <div className="agent-path-box">
                        {agent.path}
                      </div>
                    </div>
                  </div>

                  {/* Inner config card */}
                  <div className="agent-params-panel">
                    <div className="agent-params-title">
                      <Sliders size={14} color="var(--primary)" />
                      Parametry Modelu
                    </div>
                    
                    {editingId === agent.id ? (
                      <div className="space-y-3">
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-1">Config URI</label>
                          <input type="text" value={editConfig.config_uri} onChange={(e) => setEditConfig({...editConfig, config_uri: e.target.value})} className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="np. ~/.agent.json" />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-1">Model LLM</label>
                          <input type="text" value={editConfig.llm_model} onChange={(e) => setEditConfig({...editConfig, llm_model: e.target.value})} className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="gpt-4o" />
                        </div>
                        <div className="flex gap-3">
                          <div className="flex-1">
                            <label className="text-[10px] text-slate-400 block mb-1">Temp ({editConfig.temperature})</label>
                            <input type="range" min="0.0" max="1.0" step="0.1" value={editConfig.temperature} onChange={(e) => setEditConfig({...editConfig, temperature: parseFloat(e.target.value)})} className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                          </div>
                          <div className="flex-1">
                            <label className="text-[10px] text-slate-400 block mb-1">Max Tokens</label>
                            <input type="number" value={editConfig.max_tokens} onChange={(e) => setEditConfig({...editConfig, max_tokens: parseInt(e.target.value)})} className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="agent-params-grid">
                        <div className="agent-param-item">
                          <div className="agent-param-label">Model bazowy</div>
                          <div className="agent-param-value" style={{ color: '#93c5fd' }}>{agent.llm_model || 'gpt-4o'}</div>
                        </div>
                        <div className="agent-param-item">
                          <div className="agent-param-label">Config URI</div>
                          <div className="agent-param-value" style={{ fontFamily: 'monospace', fontSize: '0.75rem' }} title={agent.config_uri}>{agent.config_uri || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Brak</span>}</div>
                        </div>
                        <div className="agent-param-item">
                          <div className="agent-param-label">Temperatura</div>
                          <div className="agent-param-value">{agent.temperature ?? 0.7}</div>
                        </div>
                        <div className="agent-param-item">
                          <div className="agent-param-label">Limit Tokenów</div>
                          <div className="agent-param-value">{agent.max_tokens ?? 4096}</div>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Subtle color highlight in top corner */}
                  <div style={{
                    position: 'absolute', top: 0, left: 0, width: '4px', height: '100%',
                    background: agent.installed ? 'var(--success)' : 'var(--danger)'
                  }} />
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* LLM Server Auto-Tuner & Diagnostics Modal */}
      {showLLMModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="glass-card max-w-lg w-full p-8 border border-white/10" style={{ position: 'relative' }}>
            <button 
              onClick={() => setShowLLMModal(false)} 
              className="absolute top-4 right-4 p-1.5 bg-slate-800/40 border border-slate-700/50 rounded-lg text-gray-400 hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>
            
            <h3 className="text-2xl font-bold text-white flex items-center gap-2.5 mb-6" style={{ fontFamily: 'Outfit, sans-serif' }}>
              <Gauge className="w-6 h-6 text-purple-400" />
              Diagnostyka LLM Server
            </h3>
            
            {tuningLLM ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
                <RefreshCw className="w-8 h-8 text-purple-400 animate-spin" />
                <div>
                  <h4 className="font-semibold text-white">Strojenie i testowanie połączeń...</h4>
                  <p className="text-xs text-gray-400 mt-1">Skanujemy porty Ollama (11434), LM Studio (1234) i vLLM (8000).</p>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {llmTuneResult && (
                  <>
                    {/* Status Badge & Server Type */}
                    <div className="flex justify-between items-center bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                      <div>
                        <div className="text-[10px] uppercase font-bold text-slate-500">Wykryty Serwer</div>
                        <div className="text-base font-bold text-white mt-0.5">{llmTuneResult.type}</div>
                      </div>
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${llmTuneResult.status === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                        <span className={`w-2 h-2 rounded-full ${llmTuneResult.status === 'success' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                        {llmTuneResult.status === 'success' ? 'Online' : 'Offline'}
                      </span>
                    </div>

                    {/* Latency and Throughput metrics */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-800/80">
                        <div className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
                          <Zap className="w-3.5 h-3.5 text-amber-500" />
                          Opóźnienie (TTFT)
                        </div>
                        <div className="text-xl font-extrabold text-white mt-1">
                          {llmTuneResult.latency !== null ? `${llmTuneResult.latency} ms` : '--'}
                        </div>
                      </div>
                      
                      <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-800/80">
                        <div className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
                          <Gauge className="w-3.5 h-3.5 text-blue-500" />
                          Przepustowość
                        </div>
                        <div className="text-xl font-extrabold text-white mt-1">
                          {llmTuneResult.speed !== null ? `${llmTuneResult.speed} t/s` : '--'}
                        </div>
                      </div>
                    </div>

                    {/* URL */}
                    <div>
                      <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Adres URL Serwera</div>
                      <div className="bg-slate-950/80 px-3.5 py-2 rounded-lg border border-slate-850 text-xs text-purple-300 font-mono truncate">
                        {llmTuneResult.llmUrl || 'Brak skonfigurowanego serwera'}
                      </div>
                    </div>

                    {/* Recommendations list */}
                    <div className="space-y-2">
                      <div className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
                        <Info className="w-3.5 h-3.5 text-blue-400" />
                        Zalecenia i Wynik strojenia
                      </div>
                      
                      <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800/50 space-y-2">
                        {llmTuneResult.recommendations.map((rec, index) => (
                          <div key={index} className="text-xs text-slate-300 flex items-start gap-2">
                            <span className="text-purple-400 font-bold">•</span>
                            <span>{rec}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
                
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                  <button
                    onClick={handleAutoTuneLLM}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition text-sm font-semibold flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Ponów strojenie
                  </button>
                  <button 
                    onClick={() => setShowLLMModal(false)} 
                    className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg transition text-sm font-semibold"
                  >
                    Zamknij
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
