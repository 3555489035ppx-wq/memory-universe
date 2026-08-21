import { create } from 'zustand';

export type ToastTone = 'neutral' | 'success' | 'danger';

export interface ToastMessage {
  id: string;
  message: string;
  tone: ToastTone;
  durationMs?: number;
}

interface UiState {
  importOpen: boolean;
  immersiveOpen: boolean;
  announcement: string;
  toasts: ToastMessage[];
  dataRevision: number;
  openImport: () => void;
  closeImport: () => void;
  setImmersiveOpen: (open: boolean) => void;
  announce: (message: string) => void;
  pushToast: (message: string, tone?: ToastTone, durationMs?: number) => void;
  removeToast: (id: string) => void;
  markDataChanged: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  importOpen: false,
  immersiveOpen: false,
  announcement: '',
  toasts: [],
  dataRevision: 0,
  openImport: () => set({ importOpen: true }),
  closeImport: () => set({ importOpen: false }),
  setImmersiveOpen: (immersiveOpen) => set({ immersiveOpen }),
  announce: (announcement) => set({ announcement }),
  pushToast: (message, tone = 'neutral', durationMs) =>
    set((state) => {
      const toast: ToastMessage = durationMs === undefined
        ? { id: crypto.randomUUID(), message, tone }
        : { id: crypto.randomUUID(), message, tone, durationMs };
      return { toasts: [...state.toasts, toast].slice(-4) };
    }),
  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
  markDataChanged: () => set((state) => ({ dataRevision: state.dataRevision + 1 })),
}));
