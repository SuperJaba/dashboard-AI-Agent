import { useState, useEffect } from 'react';
import {
  History, RotateCcw, FileEdit, Terminal, GitCommit,
  RefreshCw, Eye
} from 'lucide-react';
import { apiClient } from '../shared/api-client';

export interface SnapshotSession {
  id: string;
  agent_name: string;
  started_at: string;
  stopped_at?: string;
  ended_at?: string;
}

export interface SnapshotEvent {
  id: string;
  session_id: string;
  seq: string | number;
  ts: string;
  type: 'file_write' | 'bash_cmd' | 'git_commit' | string;
  path?: string;
  diff?: string;
  cmdline?: string;
  exit_code?: number;
}

interface TimeTravelPlayerProps {
  socket?: any;
}

export function TimeTravelPlayer({ socket }: TimeTravelPlayerProps) {
  const [sessions, setSessions] = useState<SnapshotSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [events, setEvents] = useState<SnapshotEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  useEffect(() => {
    fetchSessions();
  }, []);

  useEffect(() => {
    if (selectedSessionId) {
      fetchEvents(selectedSessionId);
    }
  }, [selectedSessionId]);

  // Socket.IO live stream
  useEffect(() => {
    if (!socket) return;

    const onLiveEvent = (ev: SnapshotEvent) => {
      if (ev.session_id === selectedSessionId) {
        setEvents(prev => [...prev, ev]);
      }
    };

    socket.on('snapshot:event', onLiveEvent);
    return () => {
      socket.off('snapshot:event', onLiveEvent);
    };
  }, [socket, selectedSessionId]);

  async function fetchSessions() {
    try {
      setIsLoading(true);
      const data = await apiClient.get<SnapshotSession[]>('/api/timemachine/sessions');
      if (Array.isArray(data)) {
        setSessions(data);
        if (data.length > 0 && !selectedSessionId) {
          setSelectedSessionId(data[0].id);
        }
      }
    } catch (err: any) {
      console.warn('Błąd pobierania sesji timemachine:', err.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchEvents(sessionId: string) {
    try {
      setIsLoading(true);
      const data = await apiClient.get<SnapshotEvent[]>(`/api/timemachine/sessions/${sessionId}/events`);
      if (Array.isArray(data)) {
        setEvents(data);
        if (data.length > 0) {
          const firstFileWrite = data.find(e => e.type === 'file_write');
          setSelectedEventId(firstFileWrite ? firstFileWrite.id : data[data.length - 1].id);
        }
      }
    } catch (err: any) {
      console.warn('Błąd pobierania zdarzeń sesji:', err.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRollback(seq: string | number) {
    if (!selectedSessionId) return;
    try {
      setIsRollingBack(true);
      setStatusMessage(null);
      const res = await apiClient.post<{ success: boolean; revertedFiles: any[] }>(
        `/api/timemachine/sessions/${selectedSessionId}/rollback`,
        { seq }
      );
      if (res.success) {
        const count = res.revertedFiles?.length || 0;
        setStatusMessage({
          text: `Pomyślnie cofnięto stan do zdarzenia #${seq} (${count} odwróconych mutacji plików).`
        });
        await fetchEvents(selectedSessionId);
      }
    } catch (err: any) {
      setStatusMessage({ text: `Błąd cofania zmian: ${err.message}`, isError: true });
    } finally {
      setIsRollingBack(false);
    }
  }

  const selectedEvent = events.find(e => e.id === selectedEventId) || null;

  return (
    <div className="timemachine-player-container p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-5">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-white">
            <History className="w-6 h-6 text-cyan-400" />
            Wehikuł Czasu & Natychmiastowy Rollback (Time Travel)
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Audyt każdej mutacji plików i komend CLI z możliwością natychmiastowego cofnięcia zmian jednym kliknięciem
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchSessions}
            disabled={isLoading}
            className="px-3 py-2 text-sm bg-card/60 hover:bg-card border border-border/60 rounded-lg flex items-center gap-1.5 transition text-foreground"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Odśwież
          </button>
        </div>
      </div>

      {statusMessage && (
        <div
          className={`p-3 text-sm rounded-lg border ${
            statusMessage.isError
              ? 'bg-red-500/10 border-red-500/30 text-red-300'
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
          }`}
        >
          {statusMessage.text}
        </div>
      )}

      {/* Main Grid: Sessions & Timeline & Diff View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left column: Sessions list */}
        <div className="lg:col-span-3 space-y-3">
          <h3 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
            Sesje Agentów ({sessions.length})
          </h3>
          <div className="space-y-2 max-h-[550px] overflow-y-auto pr-1">
            {sessions.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-border/60 text-center text-sm text-muted-foreground">
                Brak zarejestrowanych sesji agentów.
              </div>
            ) : (
              sessions.map(s => (
                <div
                  key={s.id}
                  onClick={() => setSelectedSessionId(s.id)}
                  className={`p-3 rounded-xl border cursor-pointer transition ${
                    selectedSessionId === s.id
                      ? 'bg-cyan-950/40 border-cyan-500/60 shadow-md'
                      : 'bg-card/40 hover:bg-card/70 border-border/40'
                  }`}
                >
                  <div className="font-medium text-sm text-foreground">{s.agent_name}</div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    {new Date(s.started_at).toLocaleTimeString('pl-PL')} • ID: {s.id.slice(0, 8)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Center column: Event Timeline */}
        <div className="lg:col-span-5 space-y-3">
          <h3 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
            Oś Czasu Zdarzeń ({events.length})
          </h3>
          <div className="space-y-2.5 max-h-[550px] overflow-y-auto pr-1">
            {events.length === 0 ? (
              <div className="p-8 rounded-xl border border-dashed border-border/60 text-center text-sm text-muted-foreground">
                Brak zarejestrowanych zdarzeń w wybranej sesji.
              </div>
            ) : (
              events.map((ev, idx) => {
                const isSelected = selectedEventId === ev.id;
                const isFile = ev.type === 'file_write';
                const isBash = ev.type === 'bash_cmd';

                return (
                  <div
                    key={ev.id}
                    onClick={() => setSelectedEventId(ev.id)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition space-y-2 ${
                      isSelected
                        ? 'bg-card/90 border-cyan-500/60 ring-1 ring-cyan-500/40 shadow-sm'
                        : 'bg-card/30 hover:bg-card/60 border-border/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {isFile && <FileEdit className="w-4 h-4 text-emerald-400" />}
                        {isBash && <Terminal className="w-4 h-4 text-amber-400" />}
                        {!isFile && !isBash && <GitCommit className="w-4 h-4 text-purple-400" />}
                        <span className="font-semibold text-xs text-foreground uppercase tracking-wider">
                          #{idx + 1} {ev.type}
                        </span>
                      </div>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {new Date(ev.ts).toLocaleTimeString('pl-PL')}
                      </span>
                    </div>

                    <div className="text-xs font-mono break-all text-muted-foreground">
                      {isFile && (ev.path || 'Brak ścieżki pliku')}
                      {isBash && `${ev.cmdline || ''} (kod: ${ev.exit_code ?? 0})`}
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-muted-foreground/80 flex items-center gap-1">
                        Seq: {String(ev.seq)}
                      </span>

                      {isFile && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRollback(ev.seq);
                          }}
                          disabled={isRollingBack}
                          className="px-2.5 py-1 bg-cyan-600/80 hover:bg-cyan-600 text-white rounded text-[11px] font-medium flex items-center gap-1 transition"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Cofnij do tego momentu
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right column: Diff / Payload Inspector */}
        <div className="lg:col-span-4 space-y-3">
          <h3 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
            Podgląd Zmiany (Diff Inspector)
          </h3>
          <div className="bg-card/30 border border-border/50 rounded-2xl p-4 h-[550px] overflow-y-auto">
            {selectedEvent ? (
              <div className="space-y-3">
                <div className="border-b border-border/40 pb-2">
                  <div className="font-semibold text-sm text-foreground flex items-center gap-2">
                    <Eye className="w-4 h-4 text-cyan-400" />
                    Szczegóły zdarzenia #{selectedEvent.seq}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 font-mono">
                    Typ: {selectedEvent.type}
                  </div>
                  {selectedEvent.path && (
                    <div className="text-xs text-cyan-300 font-mono mt-1 break-all">
                      {selectedEvent.path}
                    </div>
                  )}
                </div>

                {selectedEvent.diff ? (
                  <pre className="text-xs font-mono whitespace-pre-wrap break-all p-3 bg-black/50 rounded-lg border border-border/40 leading-relaxed">
                    {selectedEvent.diff.split('\n').map((line, i) => {
                      let colorClass = 'text-muted-foreground';
                      if (line.startsWith('+')) colorClass = 'text-emerald-400 bg-emerald-950/20';
                      if (line.startsWith('-')) colorClass = 'text-rose-400 bg-rose-950/20';
                      if (line.startsWith('@@')) colorClass = 'text-cyan-400 font-bold';
                      return (
                        <div key={i} className={colorClass}>
                          {line}
                        </div>
                      );
                    })}
                  </pre>
                ) : selectedEvent.cmdline ? (
                  <div className="p-3 bg-black/50 rounded-lg border border-border/40 space-y-1 font-mono text-xs">
                    <div className="text-amber-400 font-semibold">$ {selectedEvent.cmdline}</div>
                    <div className="text-muted-foreground">Kod wyjścia: {selectedEvent.exit_code ?? 0}</div>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground italic">Brak danych diffa dla tego zdarzenia.</div>
                )}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-center text-xs text-muted-foreground">
                Wybierz zdarzenie z osi czasu, aby wyświetlić diff.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default TimeTravelPlayer;
