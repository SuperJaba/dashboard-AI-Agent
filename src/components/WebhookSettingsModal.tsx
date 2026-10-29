import { useState, useEffect, useCallback } from 'react';
import { Webhook, Plus, Trash2, Zap, ToggleLeft, ToggleRight, Loader2 } from 'lucide-react';

type WebhookEvent = 'agent:completed' | 'alert:triggered' | 'deploy:finished' | 'ping';

interface Webhook {
  id: string;
  url: string;
  events: WebhookEvent[];
  secret: string;
  active: boolean;
  createdAt: string;
  lastPingStatus?: 'ok' | 'error' | null;
}

const ALL_EVENTS: { value: WebhookEvent; label: string }[] = [
  { value: 'agent:completed', label: 'Agent zakończony' },
  { value: 'alert:triggered', label: 'Alert wyzwolony' },
  { value: 'deploy:finished', label: 'Deploy zakończony' },
  { value: 'ping', label: 'Ping testowy' },
];

interface Props {
  token: string | null;
}

export function WebhookSettingsModal({ token }: Props) {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pingStatus, setPingStatus] = useState<Record<string, 'sending' | 'ok' | 'error'>>({});

  // Form state
  const [formUrl, setFormUrl] = useState('');
  const [formEvents, setFormEvents] = useState<WebhookEvent[]>([]);
  const [formSecret, setFormSecret] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const authHeaders = useCallback(
    () => ({
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }),
    [token]
  );

  const fetchWebhooks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/webhooks', { headers: authHeaders() });
      if (!res.ok) { throw new Error(`HTTP ${res.status}`); }
      const data = await res.json();
      setWebhooks(data);
    } catch {
      setError('Nie udało się pobrać webhooków.');
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => { fetchWebhooks(); }, [fetchWebhooks]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!formUrl) { setFormError('URL jest wymagany.'); return; }
    if (formEvents.length === 0) { setFormError('Wybierz co najmniej jedno zdarzenie.'); return; }

    setSubmitting(true);
    try {
      const res = await fetch('/api/webhooks', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ url: formUrl, events: formEvents, secret: formSecret }),
      });
      if (!res.ok) {
        const data = await res.json();
        setFormError(data.errors?.[0]?.message ?? data.error ?? 'Błąd tworzenia webhooka');
        return;
      }
      setFormUrl('');
      setFormEvents([]);
      setFormSecret('');
      await fetchWebhooks();
    } catch {
      setFormError('Błąd połączenia z serwerem.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/webhooks/${id}`, { method: 'DELETE', headers: authHeaders() });
      setWebhooks((prev) => prev.filter((wh) => wh.id !== id));
    } catch {
      setError('Nie udało się usunąć webhooka.');
    }
  };

  const handleToggle = async (wh: Webhook) => {
    try {
      const res = await fetch(`/api/webhooks/${wh.id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ active: !wh.active }),
      });
      if (res.ok) {
        const updated = await res.json();
        setWebhooks((prev) => prev.map((w) => (w.id === wh.id ? updated : w)));
      }
    } catch {
      setError('Nie udało się zaktualizować webhooka.');
    }
  };

  const handlePing = async (id: string) => {
    setPingStatus((prev) => ({ ...prev, [id]: 'sending' }));
    try {
      const res = await fetch(`/api/webhooks/${id}/ping`, { method: 'POST', headers: authHeaders() });
      setPingStatus((prev) => ({ ...prev, [id]: res.ok ? 'ok' : 'error' }));
    } catch {
      setPingStatus((prev) => ({ ...prev, [id]: 'error' }));
    }
    setTimeout(() => setPingStatus((prev) => { const next = { ...prev }; delete next[id]; return next; }), 3000);
  };

  const toggleEvent = (ev: WebhookEvent) => {
    setFormEvents((prev) =>
      prev.includes(ev) ? prev.filter((e) => e !== ev) : [...prev, ev]
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Webhook size={18} className="text-purple-400" aria-hidden="true" />
        <h3 className="text-sm font-semibold">Webhooki</h3>
      </div>

      {/* Add webhook form */}
      <form onSubmit={handleCreate} className="flex flex-col gap-3 p-3 rounded-lg border border-white/10 bg-white/5">
        <p className="text-xs text-gray-400 font-medium">Nowy webhook</p>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-400" htmlFor="wh-url">URL Webhooka (Discord, Telegram lub standardowy HTTP)</label>
          <input
            id="wh-url"
            type="url"
            value={formUrl}
            onChange={(e) => setFormUrl(e.target.value)}
            placeholder="https://discord.com/api/webhooks/... lub https://example.com/hook"
            className="bg-white/5 border border-white/10 rounded-md px-2 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-400"
          />
          {formUrl.includes('discord.com/api/webhooks') && (
            <p className="text-[11px] text-indigo-400">
              ✓ Wykryto Discord Webhook — powiadomienia będą automatycznie sformatowane jako bogate karty Embed.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-400">Zdarzenia</label>
          <div className="flex flex-wrap gap-2">
            {ALL_EVENTS.map((ev) => (
              <button
                key={ev.value}
                type="button"
                onClick={() => toggleEvent(ev.value)}
                className={`px-2 py-1 rounded text-xs border transition-colors ${
                  formEvents.includes(ev.value)
                    ? 'bg-purple-600 border-purple-500 text-white'
                    : 'bg-white/5 border-white/10 text-gray-300 hover:border-purple-500'
                }`}
              >
                {ev.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-400" htmlFor="wh-secret">Sekret (HMAC, opcjonalny)</label>
          <input
            id="wh-secret"
            type="password"
            value={formSecret}
            onChange={(e) => setFormSecret(e.target.value)}
            placeholder="••••••••"
            className="bg-white/5 border border-white/10 rounded-md px-2 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-400"
          />
        </div>

        {formError && <p className="text-xs text-red-400">{formError}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="flex items-center justify-center gap-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-medium py-1.5 rounded-md transition-colors"
        >
          {submitting ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
          Dodaj webhook
        </button>
      </form>

      {/* Webhook list */}
      {loading && <p className="text-xs text-gray-400">Ładowanie…</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}

      {!loading && webhooks.length === 0 && (
        <p className="text-xs text-gray-500 text-center py-2">Brak zarejestrowanych webhooków.</p>
      )}

      {webhooks.map((wh) => (
        <div
          key={wh.id}
          className="flex flex-col gap-1.5 p-3 rounded-lg border border-white/10 bg-white/5"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-xs font-mono text-white truncate" title={wh.url}>{wh.url}</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {wh.events.map((ev) => (
                  <span key={ev} className="px-1.5 py-0.5 bg-purple-900/50 text-purple-300 text-xs rounded">
                    {ev}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {/* Toggle active */}
              <button
                type="button"
                onClick={() => handleToggle(wh)}
                aria-label={wh.active ? 'Dezaktywuj' : 'Aktywuj'}
                title={wh.active ? 'Aktywny – kliknij, aby dezaktywować' : 'Nieaktywny – kliknij, aby aktywować'}
                className="text-gray-400 hover:text-white transition-colors"
              >
                {wh.active
                  ? <ToggleRight size={18} className="text-green-400" />
                  : <ToggleLeft size={18} />
                }
              </button>

              {/* Ping */}
              <button
                type="button"
                onClick={() => handlePing(wh.id)}
                aria-label="Wyślij ping"
                title="Test ping"
                disabled={pingStatus[wh.id] === 'sending'}
                className="text-gray-400 hover:text-yellow-400 transition-colors disabled:opacity-50"
              >
                {pingStatus[wh.id] === 'sending'
                  ? <Loader2 size={14} className="animate-spin" />
                  : <Zap size={14} className={pingStatus[wh.id] === 'ok' ? 'text-green-400' : pingStatus[wh.id] === 'error' ? 'text-red-400' : ''} />
                }
              </button>

              {/* Delete */}
              <button
                type="button"
                onClick={() => handleDelete(wh.id)}
                aria-label="Usuń webhook"
                title="Usuń"
                className="text-gray-400 hover:text-red-400 transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          {/* Delivery status */}
          {pingStatus[wh.id] && pingStatus[wh.id] !== 'sending' && (
            <p className={`text-xs mt-1 ${pingStatus[wh.id] === 'ok' ? 'text-green-400' : 'text-red-400'}`}>
              {pingStatus[wh.id] === 'ok' ? '✓ Ping wysłany pomyślnie' : '✗ Błąd wysyłania pinga'}
            </p>
          )}

          <p className="text-xs text-gray-600">
            Dodano: {new Date(wh.createdAt).toLocaleDateString('pl-PL')}
            {' · '}
            <span className={wh.active ? 'text-green-500' : 'text-gray-500'}>
              {wh.active ? 'Aktywny' : 'Nieaktywny'}
            </span>
          </p>
        </div>
      ))}
    </div>
  );
}
