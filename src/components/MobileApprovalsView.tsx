import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, RefreshCw, ShieldAlert } from 'lucide-react';

interface ApprovalItem {
  id: string;
  action: string;
  description: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export function MobileApprovalsView() {
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchApprovals = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/approvals/pending');
      if (res.ok) {
        const data = await res.json();
        setApprovals(data.approvals || []);
      }
    } catch (err) {
      console.error('Failed to load pending approvals:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApprovals();
  }, [fetchApprovals]);

  const handleApprove = async (id: string) => {
    try {
      setProcessingId(id);
      const res = await fetch(`/api/approvals/${id}/approve`, { method: 'POST' });
      if (res.ok) {
        setActionMessage('Zatwierdzono pomyślnie ✅');
        fetchApprovals();
      }
    } catch (err) {
      console.error('Error approving request:', err);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string) => {
    try {
      setProcessingId(id);
      const res = await fetch(`/api/approvals/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Odrzucono przez użytkownika' })
      });
      if (res.ok) {
        setActionMessage('Odrzucono akcję ❌');
        fetchApprovals();
      }
    } catch (err) {
      console.error('Error rejecting request:', err);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-lg">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-indigo-400" />
            1-Tap Approvals & Mobile Control
          </h2>
          <p className="text-xs text-slate-400">
            Zatwierdzaj krytyczne akcje agentów w czasie rzeczywistym
          </p>
        </div>
        <button
          onClick={fetchApprovals}
          className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition"
          title="Odśwież zgody"
          aria-label="Odśwież zgody"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {actionMessage && (
        <div className="p-3 bg-indigo-950/60 border border-indigo-700/50 rounded-lg text-sm text-indigo-200">
          {actionMessage}
        </div>
      )}

      {/* Status bar */}
      <div className="flex items-center justify-between text-xs text-slate-400 px-1">
        <span>Oczekujące zgody ({approvals.length})</span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Gotowość do autoryzacji
        </span>
      </div>

      {/* Approvals List */}
      {loading && approvals.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          Ładowanie oczekujących zgód...
        </div>
      ) : approvals.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-slate-800 rounded-xl p-6 bg-slate-900/40">
          <CheckCircle2 className="w-10 h-10 text-emerald-500/60 mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-slate-300">Brak oczekujących zgód</h3>
          <p className="text-xs text-slate-500 mt-1">
            Wszystkie procesy agentów działają bez przeszkód w trybie autonomicznym.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {approvals.map((item) => (
            <div
              key={item.id}
              className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl shadow space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      {item.action}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {new Date(item.createdAt).toLocaleTimeString('pl-PL')}
                    </span>
                  </div>
                  <h4 className="text-sm font-medium text-slate-200">{item.description}</h4>
                </div>
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800/80">
                <button
                  type="button"
                  disabled={processingId === item.id}
                  onClick={() => handleApprove(item.id)}
                  className="flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-medium rounded-lg text-sm shadow transition disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Zatwierdź
                </button>
                <button
                  type="button"
                  disabled={processingId === item.id}
                  onClick={() => handleReject(item.id)}
                  className="flex items-center justify-center gap-2 py-2.5 px-4 bg-rose-600/80 hover:bg-rose-600 active:bg-rose-700 text-white font-medium rounded-lg text-sm shadow transition disabled:opacity-50"
                >
                  <XCircle className="w-4 h-4" />
                  Odrzuć
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
