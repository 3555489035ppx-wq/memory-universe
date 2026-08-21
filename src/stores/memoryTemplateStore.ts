import { create } from 'zustand';

import type { MemoryTemplateId, MemoryTemplateSession, PlaybackStatus, TemplateSessionOverrides } from '../memory/types';
import { getMemoryTemplate } from '../memory/config';

type TemplateSource = 'demo' | 'personal';

interface MemoryTemplateState {
  session: MemoryTemplateSession | null;
  prepare: (input: {
    templateId: MemoryTemplateId;
    source: TemplateSource;
    memoryIds: string[];
    heroPhotoId?: string | null;
    overrides?: TemplateSessionOverrides;
  }) => void;
  start: () => void;
  pause: () => void;
  resume: () => void;
  seek: (progress: number) => void;
  complete: () => void;
  replay: () => void;
  exit: () => void;
  setProgress: (progress: number) => void;
  setError: (message: string) => void;
}

function clampProgress(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

function transition(status: PlaybackStatus, next: PlaybackStatus): PlaybackStatus {
  const allowed: Record<PlaybackStatus, readonly PlaybackStatus[]> = {
    idle: ['preview', 'error'],
    preview: ['playing', 'error', 'idle'],
    playing: ['paused', 'completed', 'error', 'preview'],
    paused: ['playing', 'completed', 'error', 'preview'],
    completed: ['playing', 'preview', 'idle'],
    error: ['preview', 'idle'],
  };
  return allowed[status].includes(next) ? next : status;
}

function heroFallback(memoryIds: readonly string[], requested: string | null | undefined): string | null {
  if (requested && memoryIds.includes(requested)) return requested;
  return memoryIds[Math.floor(memoryIds.length / 2)] ?? memoryIds.at(-1) ?? null;
}

export const useMemoryTemplateStore = create<MemoryTemplateState>((set, get) => ({
  session: null,
  prepare: ({ templateId, source, memoryIds, heroPhotoId, overrides }) => {
    const config = getMemoryTemplate(templateId);
    if (!config.available) {
      set({
        session: {
          templateId,
          source,
          memoryIds: [],
          heroPhotoId: null,
          status: 'error',
          progress: 0,
          startedAt: null,
          error: '该主题正在开发中，未来将支持更多AI记忆场景。',
          ...(overrides ? { overrides } : {}),
        },
      });
      return;
    }
    const selected = [...new Set(memoryIds)].slice(0, config.maxPhotos);
    if (selected.length < config.minPhotos) {
      set({
        session: {
          templateId,
          source,
          memoryIds: selected,
          heroPhotoId: null,
          status: 'error',
          progress: 0,
          startedAt: null,
          error: `至少需要 ${String(config.minPhotos)} 张照片`,
          ...(overrides ? { overrides } : {}),
        },
      });
      return;
    }
    set({
      session: {
        templateId,
        source,
        memoryIds: selected,
        heroPhotoId: heroFallback(selected, heroPhotoId ?? overrides?.heroPhotoId),
        status: 'preview',
        progress: 0,
        startedAt: null,
        error: null,
        ...(overrides ? { overrides } : {}),
      },
    });
  },
  start: () => {
    const session = get().session;
    if (!session) return;
    const next = transition(session.status, 'playing');
    if (next !== 'playing') return;
    set({ session: { ...session, status: 'playing', startedAt: session.startedAt ?? Date.now(), error: null } });
  },
  pause: () => {
    const session = get().session;
    if (!session || transition(session.status, 'paused') !== 'paused') return;
    set({ session: { ...session, status: 'paused' } });
  },
  resume: () => {
    const session = get().session;
    if (!session || transition(session.status, 'playing') !== 'playing') return;
    set({ session: { ...session, status: 'playing', error: null } });
  },
  seek: (progress) => {
    const session = get().session;
    if (!session) return;
    const nextProgress = clampProgress(progress);
    set({
      session: {
        ...session,
        progress: nextProgress,
        status: session.status === 'completed'
          ? nextProgress >= 1 ? 'completed' : 'paused'
          : session.status,
      },
    });
  },
  complete: () => {
    const session = get().session;
    if (!session) return;
    set({ session: { ...session, status: 'completed', progress: 1 } });
  },
  replay: () => {
    const session = get().session;
    if (!session) return;
    set({ session: { ...session, status: 'playing', progress: 0, startedAt: Date.now(), error: null } });
  },
  exit: () => set({ session: null }),
  setProgress: (progress) => {
    const session = get().session;
    if (!session) return;
    const nextProgress = clampProgress(progress);
    if (nextProgress >= 1) {
      set({ session: { ...session, status: 'completed', progress: 1 } });
    } else {
      set({ session: { ...session, progress: nextProgress } });
    }
  },
  setError: (message) => {
    const session = get().session;
    if (!session) return;
    set({ session: { ...session, status: 'error', error: message } });
  },
}));
