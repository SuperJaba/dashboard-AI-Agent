import React, { useState, useMemo } from 'react';
import { Columns, AlignLeft } from 'lucide-react';
import { parseUnifiedDiff } from '../utils/diffParser';

interface SplitDiffViewerProps {
  diff: string;
  defaultMode?: 'split' | 'unified';
}

export const SplitDiffViewer: React.FC<SplitDiffViewerProps> = ({
  diff,
  defaultMode = 'split',
}) => {
  const [viewMode, setViewMode] = useState<'split' | 'unified'>(defaultMode);

  const parsedRows = useMemo(() => parseUnifiedDiff(diff), [diff]);

  const stats = useMemo(() => {
    let additions = 0;
    let deletions = 0;
    const lines = (diff || '').split(/\r?\n/);
    for (const l of lines) {
      if (l.startsWith('+') && !l.startsWith('+++')) additions++;
      else if (l.startsWith('-') && !l.startsWith('---')) deletions++;
    }
    return { additions, deletions };
  }, [diff]);

  if (!diff || diff.trim() === '' || diff.trim() === 'No differences found.') {
    return (
      <div
        style={{
          padding: '2.5rem',
          textAlign: 'center',
          color: '#94a3b8',
          fontSize: '0.9rem',
          background: 'rgba(15, 23, 42, 0.6)',
          borderRadius: '0.75rem',
          border: '1px dashed rgba(255, 255, 255, 0.1)',
        }}
      >
        Brak różnic do wyświetlenia (Working tree clean).
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '0.5rem' }}>
      {/* Controls Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.4rem 0.6rem',
          background: 'rgba(15, 23, 42, 0.8)',
          borderRadius: '0.5rem',
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', fontSize: '0.8rem' }}>
          <span style={{ color: '#34d399', fontWeight: 600 }}>+{stats.additions}</span>
          <span style={{ color: '#f87171', fontWeight: 600 }}>-{stats.deletions}</span>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
            ({stats.additions + stats.deletions} zmienionych linii)
          </span>
        </div>

        <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setViewMode('split')}
            title="Widok Split (Lewa | Prawa)"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
              padding: '0.25rem 0.6rem',
              fontSize: '0.75rem',
              borderRadius: '4px',
              border: 'none',
              cursor: 'pointer',
              background: viewMode === 'split' ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
              color: viewMode === 'split' ? '#38bdf8' : '#94a3b8',
              fontWeight: viewMode === 'split' ? 600 : 400,
            }}
          >
            <Columns size={13} />
            Lewa | Prawa (Split)
          </button>
          <button
            type="button"
            onClick={() => setViewMode('unified')}
            title="Widok Unified (Jednokolumnowy)"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
              padding: '0.25rem 0.6rem',
              fontSize: '0.75rem',
              borderRadius: '4px',
              border: 'none',
              cursor: 'pointer',
              background: viewMode === 'unified' ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
              color: viewMode === 'unified' ? '#38bdf8' : '#94a3b8',
              fontWeight: viewMode === 'unified' ? 600 : 400,
            }}
          >
            <AlignLeft size={13} />
            Jednokolumnowy
          </button>
        </div>
      </div>

      {/* Main Diff Content Container */}
      <div
        style={{
          background: '#020617',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '0.75rem',
          overflow: 'auto',
          flex: 1,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          fontSize: '0.78rem',
          lineHeight: '1.45',
        }}
      >
        {viewMode === 'split' ? (
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: '700px' }}>
            {/* Split Headers */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                background: '#090d16',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                position: 'sticky',
                top: 0,
                zIndex: 10,
              }}
            >
              <div
                style={{
                  padding: '0.4rem 0.75rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: '#f87171',
                  borderRight: '1px solid rgba(255, 255, 255, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444' }} />
                Lewa: Oryginał / Poprzednia wersja (Base)
              </div>
              <div
                style={{
                  padding: '0.4rem 0.75rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: '#34d399',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
                Prawa: Zmodyfikowana wersja (Current)
              </div>
            </div>

            {/* Split Rows */}
            {parsedRows.map((row, idx) => {
              if (row.type === 'header') {
                return (
                  <div
                    key={idx}
                    style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      color: '#64748b',
                      padding: '0.2rem 0.75rem',
                      fontSize: '0.72rem',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                    }}
                  >
                    {row.header}
                  </div>
                );
              }

              if (row.type === 'hunk') {
                return (
                  <div
                    key={idx}
                    style={{
                      background: 'rgba(56, 189, 248, 0.08)',
                      color: '#38bdf8',
                      padding: '0.25rem 0.75rem',
                      fontWeight: 600,
                      borderTop: '1px solid rgba(56, 189, 248, 0.2)',
                      borderBottom: '1px solid rgba(56, 189, 248, 0.2)',
                    }}
                  >
                    {row.header}
                  </div>
                );
              }

              const isLeftRemoved = row.left?.type === 'removed';
              const isRightAdded = row.right?.type === 'added';

              const leftBg = isLeftRemoved ? 'rgba(239, 68, 68, 0.16)' : 'transparent';
              const leftColor = isLeftRemoved ? '#fca5a5' : '#cbd5e1';

              const rightBg = isRightAdded ? 'rgba(16, 185, 129, 0.16)' : 'transparent';
              const rightColor = isRightAdded ? '#6ee7b7' : '#cbd5e1';

              return (
                <div
                  key={idx}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
                  }}
                >
                  {/* Left Column */}
                  <div
                    style={{
                      display: 'flex',
                      background: leftBg,
                      color: leftColor,
                      borderRight: '1px solid rgba(255, 255, 255, 0.1)',
                      borderLeft: isLeftRemoved ? '3px solid #ef4444' : '3px solid transparent',
                      minHeight: '20px',
                    }}
                  >
                    <span
                      style={{
                        width: '42px',
                        minWidth: '42px',
                        padding: '1px 6px',
                        textAlign: 'right',
                        userSelect: 'none',
                        color: isLeftRemoved ? '#f87171' : '#475569',
                        background: 'rgba(0, 0, 0, 0.25)',
                        borderRight: '1px solid rgba(255, 255, 255, 0.05)',
                        fontSize: '0.72rem',
                      }}
                    >
                      {row.left?.lineNum ?? ''}
                    </span>
                    <span
                      style={{
                        padding: '1px 8px',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                        flex: 1,
                      }}
                    >
                      {row.left?.text ?? ''}
                    </span>
                  </div>

                  {/* Right Column */}
                  <div
                    style={{
                      display: 'flex',
                      background: rightBg,
                      color: rightColor,
                      borderLeft: isRightAdded ? '3px solid #10b981' : '3px solid transparent',
                      minHeight: '20px',
                    }}
                  >
                    <span
                      style={{
                        width: '42px',
                        minWidth: '42px',
                        padding: '1px 6px',
                        textAlign: 'right',
                        userSelect: 'none',
                        color: isRightAdded ? '#34d399' : '#475569',
                        background: 'rgba(0, 0, 0, 0.25)',
                        borderRight: '1px solid rgba(255, 255, 255, 0.05)',
                        fontSize: '0.72rem',
                      }}
                    >
                      {row.right?.lineNum ?? ''}
                    </span>
                    <span
                      style={{
                        padding: '1px 8px',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                        flex: 1,
                      }}
                    >
                      {row.right?.text ?? ''}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Unified Single-Column View */
          <div style={{ padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '1px' }}>
            {diff.split(/\r?\n/).map((line, idx) => {
              let color = '#cbd5e1';
              let bg = 'transparent';
              let borderLeft = '3px solid transparent';

              if (line.startsWith('+') && !line.startsWith('+++')) {
                color = '#6ee7b7';
                bg = 'rgba(16, 185, 129, 0.16)';
                borderLeft = '3px solid #10b981';
              } else if (line.startsWith('-') && !line.startsWith('---')) {
                color = '#fca5a5';
                bg = 'rgba(239, 68, 68, 0.16)';
                borderLeft = '3px solid #ef4444';
              } else if (line.startsWith('@@')) {
                color = '#38bdf8';
                bg = 'rgba(56, 189, 248, 0.08)';
              }

              return (
                <div
                  key={idx}
                  style={{
                    color,
                    background: bg,
                    borderLeft,
                    padding: '2px 8px',
                    borderRadius: '2px',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                  }}
                >
                  {line || ' '}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
