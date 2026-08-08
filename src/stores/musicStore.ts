import { create } from 'zustand';

export interface MusicTrack {
  id: string;
  name: string;
  fileName: string;
  src: string;
  source?: 'local' | 'remote';
  provider?: 'netease' | 'qq';
  remoteId?: string;
  mediaMid?: string;
  artist?: string;
  album?: string;
  cover?: string;
  duration?: number;
}

export type MusicStatus = 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'error';

interface MusicState {
  track: MusicTrack | null;
  queue: MusicTrack[];
  queueIndex: number;
  status: MusicStatus;
  error: string | null;
  currentTime: number;
  duration: number;
  volume: number;
  energy: number;
  bass: number;
  mid: number;
  treble: number;
  beat: number;
  consoleOpen: boolean;
  setTrack: (track: MusicTrack | null) => void;
  setTrackSource: (trackId: string, src: string) => void;
  setQueue: (queue: MusicTrack[]) => void;
  playQueueTrack: (queue: MusicTrack[], index: number) => void;
  playNextTrack: () => void;
  setStatus: (status: MusicStatus, error?: string | null) => void;
  setProgress: (currentTime: number, duration: number) => void;
  setVolume: (volume: number) => void;
  setSpectrum: (spectrum: Pick<MusicState, 'energy' | 'bass' | 'mid' | 'treble' | 'beat'>) => void;
  setConsoleOpen: (open: boolean) => void;
}

export const useMusicStore = create<MusicState>((set) => ({
  track: null,
  queue: [],
  queueIndex: -1,
  status: 'idle',
  error: null,
  currentTime: 0,
  duration: 0,
  volume: 0.72,
  energy: 0,
  bass: 0,
  mid: 0,
  treble: 0,
  beat: 0,
  consoleOpen: false,
  setTrack: (track) =>
    set({
      track: track ? { source: 'local', ...track } : null,
      status: track ? 'ready' : 'idle',
      error: null,
      currentTime: 0,
      duration: 0,
    }),
  setTrackSource: (trackId, src) =>
    set((state) => {
      if (!state.track || state.track.id !== trackId) return state;
      return {
        track: { ...state.track, src },
        status: 'ready',
        error: null,
      };
    }),
  setQueue: (queue) => set({ queue, queueIndex: queue.length > 0 ? 0 : -1 }),
  playQueueTrack: (queue, index) => {
    const nextTrack = queue[index];
    set({
      queue,
      queueIndex: nextTrack ? index : -1,
      track: nextTrack ? { source: 'remote', ...nextTrack } : null,
      status: nextTrack ? 'ready' : 'idle',
      error: null,
      currentTime: 0,
      duration: 0,
    });
  },
  playNextTrack: () =>
    set((state) => {
      const nextIndex = state.queueIndex + 1;
      const nextTrack = state.queue[nextIndex];
      if (!nextTrack) return { status: 'paused', currentTime: 0 };
      return {
        queueIndex: nextIndex,
        track: { source: 'remote', ...nextTrack },
        status: 'ready',
        error: null,
        currentTime: 0,
        duration: 0,
      };
    }),
  setStatus: (status, error = null) => set({ status, error }),
  setProgress: (currentTime, duration) => set({ currentTime, duration }),
  setVolume: (volume) => set({ volume: Math.min(1, Math.max(0, volume)) }),
  setSpectrum: (spectrum) => set(spectrum),
  setConsoleOpen: (consoleOpen) => set({ consoleOpen }),
}));
