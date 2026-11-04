import type { ReactNode } from 'react';

export interface FormFieldProps {
  label?: string;
  htmlFor?: string;
  error?: string | null;
  hint?: string | null;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

export function FormField({
  label,
  htmlFor,
  error,
  hint,
  required = false,
  children,
  className = '',
}: FormFieldProps) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="text-xs font-semibold text-[var(--text-muted,#94a3b8)] flex items-center gap-1"
        >
          {label}
          {required && <span className="text-rose-400" aria-hidden="true">*</span>}
        </label>
      )}
      {children}
      {error && (
        <div
          role="alert"
          aria-live="polite"
          className="text-xs text-rose-400 font-medium flex items-center gap-1"
        >
          {error}
        </div>
      )}
      {hint && !error && (
        <p className="text-xs text-[var(--text-muted,#94a3b8)]">{hint}</p>
      )}
    </div>
  );
}
