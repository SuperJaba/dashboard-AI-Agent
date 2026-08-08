import React, { useState, useEffect, useRef } from 'react';
import { Plus, Download, Upload, Check, Trash2, Edit3, X, Cpu, Globe, Key, Layers } from 'lucide-react';
import { apiFetch } from './shared/api-client';

export interface LlmServer {
  id: number;
  name: string;
  url: string;
  api_key?: string;
  model?: string;
  provider?: string;
  is_active?: boolean;
}

interface LlmServerManagerProps {
  onServerSelected?: (server: LlmServer) => void;
}

export function LlmServerManager({ onServerSelected }: LlmServerManagerProps) {
  const [servers, setServers] = useState<LlmServer[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingServer, setEditingServer] = useState<LlmServer | null>(null);
  const [notification, setNotification] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: '',
    url: '',
    api_key: '',
    model: '',
    provider: 'LM Studio'
  });

  const fetchServers = async () => {
    try {
      const res = await apiFetch('/api/llm-servers');
      if (res.ok) {
        const data = await res.json();
        setServers(data || []);
      }
    } catch (e) {
      console.error('Failed to fetch LLM servers:', e);
    }
  };

  useEffect(() => {
    fetchServers();
  }, []);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const activeServer = servers.find(s => s.is_active) || (servers.length > 0 ? servers[0] : null);

  const handleSelectServer = async (id: number) => {
    try {
      const res = await apiFetch(`/api/llm-servers/select/${id}`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setServers(servers.map(s => ({ ...s, is_active: s.id === id })));
        setNotification('Zmieniono aktywny serwer LLM');
        if (onServerSelected && data.selected) {
          onServerSelected(data.selected);
        }
      }
    } catch (e) {
      console.error('Failed to select LLM server:', e);
    }
  };

  const handleOpenNewModal = () => {
    setEditingServer(null);
    setFormData({ name: '', url: 'http://127.0.0.1:1337/v1', api_key: '', model: '', provider: 'LM Studio' });
    setShowModal(true);
  };

  const handleOpenEditModal = (server: LlmServer) => {
    setEditingServer(server);
    setFormData({
      name: server.name || '',
      url: server.url || '',
      api_key: server.api_key || '',
      model: server.model || '',
      provider: server.provider || 'Custom'
    });
    setShowModal(true);
  };

  const handleSaveServer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.url) return;

    try {
      if (editingServer) {
        const res = await apiFetch(`/api/llm-servers/${editingServer.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.name,
            url: formData.url,
            apiKey: formData.api_key,
            model: formData.model,
            provider: formData.provider
          })
        });
        if (res.ok) {
          setNotification('Zaktualizowano serwer LLM');
          setShowModal(false);
          await fetchServers();
        }
      } else {
        const res = await apiFetch('/api/llm-servers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.name,
            url: formData.url,
            apiKey: formData.api_key,
            model: formData.model,
            provider: formData.provider,
            is_active: servers.length === 0
          })
        });
        if (res.ok) {
          setNotification('Dodano nowy serwer LLM');
          setShowModal(false);
          await fetchServers();
        }
      }
    } catch (e) {
      console.error('Failed to save LLM server:', e);
    }
  };

  const handleDeleteServer = async (id: number) => {
    if (!confirm('Czy na pewno chcesz usunąć ten serwer LLM?')) return;
    try {
      const res = await apiFetch(`/api/llm-servers/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setNotification('Usunięto serwer LLM');
        await fetchServers();
      }
    } catch (e) {
      console.error('Failed to delete LLM server:', e);
    }
  };

  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(servers, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "llm_servers.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    setNotification('Wyeksportowano listę serwerów do llm_servers.json');
  };

  const handleImportClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const content = event.target?.result as string;
          const parsed = JSON.parse(content);
          const serversList = Array.isArray(parsed) ? parsed : (parsed.servers || []);
          
          const res = await apiFetch('/api/llm-servers/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ servers: serversList })
          });

          if (res.ok) {
            const result = await res.json();
            setNotification(`Zaimportowano ${result.count || serversList.length} serwerów LLM`);
            await fetchServers();
          }
        } catch (err) {
          alert('Niepoprawny plik JSON z konfiguracją serwerów LLM.');
        }
      };
      reader.readAsText(file);
    } catch (err) {
      console.error('Import error:', err);
    }
    e.target.value = '';
  };

  return (
    <>
      <header className="header animate-in delay-1" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
        {notification && (
          <div style={{ width: '100%', background: 'rgba(16, 185, 129, 0.2)', color: '#10B981', border: '1px solid #10B981', borderRadius: '8px', padding: '0.5rem 1rem', marginBottom: '1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Check size={16} /> {notification}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Cpu size={22} color="var(--primary)" />
          <div>
            <span className="info-label" style={{ display: 'block', fontSize: '0.75rem' }}>Wybrany Serwer LLM</span>
            <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'white' }}>
              {activeServer ? `${activeServer.name} (${activeServer.provider || 'Custom'})` : 'Brak skojarzonego serwera DB'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ position: 'relative' }}>
            <select
              aria-label="Wybierz serwer LLM"
              value={activeServer ? activeServer.id : ''}
              onChange={(e) => handleSelectServer(Number(e.target.value))}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid var(--glass-border)',
                borderRadius: '8px',
                padding: '0.45rem 2rem 0.45rem 0.75rem',
                color: 'white',
                fontSize: '0.85rem',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              {servers.length === 0 && <option value="" disabled>Brak serwerów w DB</option>}
              {servers.map(s => (
                <option key={s.id} value={s.id} style={{ background: '#1e1e2e', color: 'white' }}>
                  {s.name} {s.model ? `[${s.model}]` : ''} ({s.url})
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className="btn btn-primary"
            onClick={handleOpenNewModal}
            style={{ padding: '0.45rem 0.85rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <Plus size={16} /> New LLM Server
          </button>

          <button
            type="button"
            className="btn-add-project"
            onClick={handleExportJSON}
            title="Eksportuj konfigurację do pliku JSON"
            style={{ padding: '0.45rem 0.75rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <Download size={15} /> Export
          </button>

          <button
            type="button"
            className="btn-add-project"
            onClick={handleImportClick}
            title="Importuj konfigurację z pliku JSON"
            style={{ padding: '0.45rem 0.75rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <Upload size={15} /> Import
          </button>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".json"
            style={{ display: 'none' }}
          />

          {activeServer && (
            <button
              type="button"
              onClick={() => handleOpenEditModal(activeServer)}
              title="Edytuj serwer"
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.3rem' }}
            >
              <Edit3 size={16} />
            </button>
          )}
        </div>

        {/* Details of active server */}
        {activeServer && (
          <div style={{ width: '100%', marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Globe size={14} color="#38bdf8" /> <span>URL:</span> <strong style={{ color: '#f3f4f6' }}>{activeServer.url}</strong>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Layers size={14} color="#a855f7" /> <span>Model:</span> <strong style={{ color: '#f3f4f6' }}>{activeServer.model || 'Domyślny'}</strong>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Key size={14} color="#f59e0b" /> <span>API Key:</span> <strong style={{ color: '#f3f4f6' }}>{activeServer.api_key ? '••••••••' : 'Brak'}</strong>
            </div>
          </div>
        )}
      </header>

      {/* Modal Nowy / Edycja Serwera LLM */}
      {showModal && (
        <div
          role="dialog"
          aria-modal="true"
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}
        >
          <div className="glass-card animate-in" style={{ width: '480px', maxWidth: '92vw', padding: '1.5rem', position: 'relative' }}>
            <button
              type="button"
              onClick={() => setShowModal(false)}
              style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              aria-label="Close modal"
            >
              <X size={20} />
            </button>
            <h2 id="new-llm-server-modal-title" style={{ marginBottom: '1.5rem', color: 'white' }}>
              {editingServer ? 'Edytuj Serwer LLM' : 'Nowy Serwer LLM'}
            </h2>
            <form onSubmit={handleSaveServer} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label className="info-label" style={{ fontSize: '0.75rem', marginBottom: '0.25rem', display: 'block' }}>Nazwa serwera</label>
                <input
                  type="text"
                  required
                  placeholder="np. LM Studio Local lub NVIDIA NIM"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '0.6rem 0.8rem', color: 'white', outline: 'none' }}
                />
              </div>
              <div>
                <label className="info-label" style={{ fontSize: '0.75rem', marginBottom: '0.25rem', display: 'block' }}>Dostawca (Provider)</label>
                <select
                  value={formData.provider}
                  onChange={e => setFormData({ ...formData, provider: e.target.value })}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '0.6rem 0.8rem', color: 'white', outline: 'none' }}
                >
                  <option value="LM Studio" style={{ background: '#1e1e2e' }}>LM Studio</option>
                  <option value="NVIDIA" style={{ background: '#1e1e2e' }}>NVIDIA NIM</option>
                  <option value="Ollama" style={{ background: '#1e1e2e' }}>Ollama</option>
                  <option value="vLLM" style={{ background: '#1e1e2e' }}>vLLM / Local Server</option>
                  <option value="Anthropic" style={{ background: '#1e1e2e' }}>Anthropic Official</option>
                  <option value="Custom" style={{ background: '#1e1e2e' }}>Inny (Custom API)</option>
                </select>
              </div>
              <div>
                <label className="info-label" style={{ fontSize: '0.75rem', marginBottom: '0.25rem', display: 'block' }}>URL API (Base URL)</label>
                <input
                  type="text"
                  required
                  placeholder="http://127.0.0.1:1337/v1 lub https://integrate.api.nvidia.com/v1"
                  value={formData.url}
                  onChange={e => setFormData({ ...formData, url: e.target.value })}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '0.6rem 0.8rem', color: 'white', outline: 'none' }}
                />
              </div>
              <div>
                <label className="info-label" style={{ fontSize: '0.75rem', marginBottom: '0.25rem', display: 'block' }}>Model LLM</label>
                <input
                  type="text"
                  placeholder="np. google/gemma-4-e4b lub meta/llama-3.3-70b-instruct"
                  value={formData.model}
                  onChange={e => setFormData({ ...formData, model: e.target.value })}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '0.6rem 0.8rem', color: 'white', outline: 'none' }}
                />
              </div>
              <div>
                <label className="info-label" style={{ fontSize: '0.75rem', marginBottom: '0.25rem', display: 'block' }}>Klucz API (API Key / Token)</label>
                <input
                  type="password"
                  placeholder="Opcjonalne dla serwerów lokalnych"
                  value={formData.api_key}
                  onChange={e => setFormData({ ...formData, api_key: e.target.value })}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '0.6rem 0.8rem', color: 'white', outline: 'none' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                {editingServer && (
                  <button
                    type="button"
                    onClick={() => { handleDeleteServer(editingServer.id); setShowModal(false); }}
                    style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', border: '1px solid #ef4444', borderRadius: '8px', padding: '0.6rem 1rem', cursor: 'pointer' }}
                  >
                    <Trash2 size={16} /> Usuń
                  </button>
                )}
                <button type="button" className="btn-secondary" style={{ flex: 1, padding: '0.6rem' }} onClick={() => setShowModal(false)}>
                  Anuluj
                </button>
                <button type="submit" className="btn-primary" style={{ flex: 1, padding: '0.6rem' }}>
                  Zapisz Serwer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
