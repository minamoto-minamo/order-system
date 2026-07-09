import { create } from 'zustand';
import type { ToastVariant } from '@/components/display/Toast/Toast';

export type ToastItem = {
  id: number;
  message: string;
  variant: ToastVariant;
};

interface ToastStore {
  toasts: ToastItem[];
  showToast: (message: string, variant?: ToastVariant) => void;
}

let nextToastId = 1;
const TOAST_DURATION_MS = 1800;

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  showToast: (message, variant = 'default') => {
    const id = nextToastId++;
    set((state) => ({
      toasts: [...state.toasts, { id, message, variant }],
    }));
    window.setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((toast) => toast.id !== id),
      }));
    }, TOAST_DURATION_MS);
  },
}));
