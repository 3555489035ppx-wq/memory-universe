import { create } from 'zustand';

export type ToastTone = 'neutral' | 'success' | 'danger';

export interface ToastMessage {
  id: string;
  message: string;
  tone: ToastTone;
}

interface UiState {
  importOpen: boolean;
  announcement: string;
  toasts: ToastMessage[];
  dataRevision: number;
  openImport: () => void;
  closeImport: () => void;
  announce: (message: string) => void;
  pushToast: (message: string, tone?: ToastTone) => void;
  removeToast: (id: string) => void;
  markDataChanged: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  importOpen: false,
  announcement: '',
  toasts: [],
  dataRevision: 0,
  openImport: () => set({ importOpen: true }),
  closeImport: () => set({ importOpen: false }),
  announce: (announcement) => set({ announcement }),
  pushToast: (message, tone = 'neutral') =>
    set((state) => ({
      toasts: [...state.toasts, { id: crypto.randomUUID(), message, tone }].slice(-4),
    })),
  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
  markDataChanged: () => set((state) => ({ dataRevision: state.dataRevision + 1 })),
}));
