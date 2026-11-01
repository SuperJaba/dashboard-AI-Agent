import React, { useState } from 'react';
import { AlertOctagon, Loader2, CheckCircle2 } from 'lucide-react';
import { apiClient } from '../shared/api-client';

interface EmergencyStopResponse {
  success: boolean;
  terminatedTasks: number;
  killedProcesses: number;
  freedVram: boolean;
}

export function EmergencyPanicButton() {
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleTrigger = async () => {
    setLoading(true);
    try {
      const res = await apiClient.post<EmergencyStopResponse>('/api/agents/emergency-stop');
      const vramInfo = res.freedVram ? ' i zwolniono VRAM' : '';
      setFeedback(`Zatrzymano ${res.terminatedTasks} zadań, ${res.killedProcesses} procesów${vramInfo}.`);
      setShowConfirm(false);
      setTimeout(() => setFeedback(null), 5000);
    } catch (err: any) {
      setFeedback(`Błąd zatrzymania: ${err.message || 'Nieznany błąd'}`);
      setShowConfirm(false);
      setTimeout(() => setFeedback(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <button
        type="button"
        onClick={() => setShowConfirm(true)}
        disabled={loading}
        className="btn-panic"
        aria-label="Emergency Stop / Panic"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.45rem',
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          color: '#f87171',
          padding: '0.45rem 0.85rem',
          borderRadius: '8px',
          fontWeight: 600,
          fontSize: '0.85rem',
          cursor: loading ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        title="Natychmiastowe zatrzymanie wszystkich agentów CLI i zwolnienie modeli LLM"
      >
        <AlertOctagon size={16} color="#ef4444" aria-hidden="true" />
        <span>Panic Stop</span>
      </button>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div
            style={{
              background: '#111827',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '12px',
              padding: '1.5rem',
              maxWidth: '420px',
              width: '90%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 0 30px rgba(239, 68, 68, 0.15)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.2)',
                  padding: '0.5rem',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AlertOctagon size={24} color="#ef4444" />
              </div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#f3f4f6', fontWeight: 700 }}>
                Potwierdź zatrzymanie awaryjne
              </h3>
            </div>

            <p style={{ color: '#9ca3af', fontSize: '0.9rem', lineHeight: '1.5', marginBottom: '1.5rem' }}>
              Ta operacja natychmiast wyśle sygnał <code>SIGTERM</code> do wszystkich procesów CLI agentów,
              przerwie aktywne zadania w tle i zwolni pamięć VRAM lokalnych serwerów LLM.
            </p>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={loading}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#d1d5db',
                  padding: '0.5rem 1rem',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                }}
              >
                Anuluj
              </button>
              <button
                type="button"
                onClick={handleTrigger}
                disabled={loading}
                style={{
                  background: '#dc2626',
                  border: 'none',
                  color: '#ffffff',
                  padding: '0.5rem 1.25rem',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                <span>Zatrzymaj wszystko</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Result Toast Notification */}
      {feedback && (
        <div
          role="status"
          style={{
            position: 'fixed',
            bottom: '1.5rem',
            right: '1.5rem',
            background: '#064e3b',
            border: '1px solid #059669',
            color: '#a7f3d0',
            padding: '0.75rem 1.25rem',
            borderRadius: '8px',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.4)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            fontSize: '0.875rem',
            zIndex: 10000,
          }}
        >
          <CheckCircle2 size={18} color="#34d399" />
          <span>{feedback}</span>
        </div>
      )}
    </div>
  );
}
