import { createContext, useContext } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration: number;
}

export interface ToastApi {
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
}

export interface ToastContextValue {
  toast: ToastApi;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

const fallbackToast: ToastApi = {
  success: () => {},
  error: () => {},
  warning: () => {},
  info: () => {},
};

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) {
    return fallbackToast;
  }
  return context.toast;
}
