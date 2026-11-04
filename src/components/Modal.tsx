import React, { useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
  className?: string;
}

export function Modal({
  isOpen,
  onClose,
  title,
  icon,
  children,
  footer,
  maxWidth = '550px',
  className = '',
}: ModalProps) {
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    // Prevent body scrolling while modal is open
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  const modalContent = (
    <div
      role="presentation"
      data-testid="modal-backdrop"
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity duration-200 motion-reduce:transition-none"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{
          maxWidth,
          backgroundColor: 'var(--bg-surface, #0f172a)',
          color: 'var(--text-main, #f8fafc)',
          border: '1px solid var(--border-color, rgba(255,255,255,0.1))',
          boxShadow: 'var(--glass-shadow, 0 10px 30px -5px rgba(0, 0, 0, 0.5))',
        }}
        className={`relative w-full rounded-xl flex flex-col overflow-hidden transition-all duration-200 motion-reduce:transition-none motion-reduce:transform-none ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between gap-3 px-5 py-4 border-b"
          style={{ borderColor: 'var(--border-color, rgba(255,255,255,0.08))' }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {icon && (
              <span className="shrink-0 flex items-center text-[var(--primary,#4F46E5)]" aria-hidden="true">
                {icon}
              </span>
            )}
            <h2 id={titleId} className="text-base font-semibold truncate">
              {title}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 shrink-0"
            aria-label="Zamknij"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto max-h-[calc(85vh-120px)]">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div
            className="flex items-center justify-end gap-3 px-5 py-3 border-t bg-black/10"
            style={{ borderColor: 'var(--border-color, rgba(255,255,255,0.08))' }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  if (typeof document !== 'undefined' && document.body) {
    return createPortal(modalContent, document.body);
  }

  return modalContent;
}

export default Modal;
