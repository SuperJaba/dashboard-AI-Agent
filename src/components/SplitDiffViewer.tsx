import React from 'react';
import { X, Check, GitCommit } from 'lucide-react';

interface SplitDiffViewerProps {
  diff: string;
  agentName: string;
  onApply?: () => void;
  onClose: () => void;
}

export function SplitDiffViewer({ diff, agentName, onApply, onClose }: SplitDiffViewerProps) {
  const lines = diff ? diff.split('\n') : [];

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <GitCommit className="w-5 h-5 text-indigo-400" />
            <div>
              <h3 className="text-base font-bold text-slate-100">
                Porównanie Wyników — Agent Arena
              </h3>
              <p className="text-xs text-slate-400">
                Alternatywna wersja wygenerowana przez: <span className="font-semibold text-indigo-300">{agentName}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition"
            aria-label="Zamknij"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Diff content */}
        <div className="flex-1 overflow-auto p-4 font-mono text-xs bg-slate-950 text-slate-300 leading-relaxed">
          {lines.length === 0 ? (
            <p className="text-slate-500 italic p-4">Brak zmian pomiędzy implementacjami.</p>
          ) : (
            lines.map((line, idx) => {
              const isAdded = line.startsWith('+') && !line.startsWith('+++');
              const isRemoved = line.startsWith('-') && !line.startsWith('---');
              const isHeader = line.startsWith('@@') || line.startsWith('diff --git');

              let lineClass = 'text-slate-400';
              if (isAdded) lineClass = 'bg-emerald-950/40 text-emerald-300 font-medium px-1';
              if (isRemoved) lineClass = 'bg-rose-950/40 text-rose-300 font-medium px-1 line-through';
              if (isHeader) lineClass = 'text-sky-400 font-bold bg-sky-950/20 px-1 my-1';

              return (
                <div key={idx} className={`${lineClass} whitespace-pre-wrap font-mono`}>
                  {line}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-800 bg-slate-950/80">
          <span className="text-xs text-slate-400">
            {lines.length} linii w zestawieniu diff
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition"
            >
              Zamknij
            </button>
            {onApply && (
              <button
                onClick={onApply}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow transition"
              >
                <Check className="w-4 h-4" />
                Zastosuj wynik
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
