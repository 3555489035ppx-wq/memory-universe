import { create } from 'zustand';

import type { AudioPresetId } from '../features/music/audioPresets';

export type MusicTrackSource = 'system' | 'upload';

export interface MusicTrack {
  id: string;
  name: string;
  fileName: string;
  src: string;
  source?: MusicTrackSource;
  artist?: string;
  album?: string;
  cover?: string;
  duration?: number;
  category?: string;
  /** Runtime-only file used by local upload and deterministic export. */
  localFile?: File;
}

export type MusicStatus = 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'error';
export type PlaybackMode = 'queue' | 'repeat' | 'shuffle';
export type AudioGraphStatus = 'idle' | 'loading' | 'ready' | 'fallback' | 'error';

export interface MusicAudioMeter {
  samplePeakDbfs: number;
  truePeakDbtp: number | null;
  compressorReductionDb: number;
  limiterReductionDb: number;
  clipping: boolean;
}

function normalizedTrack(track: MusicTrack): MusicTrack {
  return { ...track, source: track.source ?? 'system' };
}

interface MusicState {
  track: MusicTrack | null;
  queue: MusicTrack[];
  uploads: MusicTrack[];
  queueIndex: number;
  status: MusicStatus;
  error: string | null;
  currentTime: number;
  duration: number;
  volume: number;
  playbackMode: PlaybackMode;
  autoMix: boolean;
  fadeInDuration: number;
  fadeOutDuration: number;
  audioEnhancement: boolean;
  audioPreset: AudioPresetId;
  audioGraphStatus: AudioGraphStatus;
  audioMeter: MusicAudioMeter;
  lyricOffset: number;
  consoleOpen: boolean;
  setTrack: (track: MusicTrack | null) => void;
  setQueue: (queue: MusicTrack[]) => void;
  playQueueTrack: (queue: MusicTrack[], index: number) => void;
  enqueueTrack: (track: MusicTrack) => void;
  addUploadedTrack: (track: MusicTrack) => void;
  removeUploadedTrack: (trackId: string) => void;
  removeQueueTrack: (index: number) => void;
  moveQueueTrackNext: (index: number) => void;
  playNextTrack: () => void;
  cyclePlaybackMode: () => void;
  setAutoMix: (autoMix: boolean) => void;
  setFadeInDuration: (duration: number) => void;
  setFadeOutDuration: (duration: number) => void;
  setAudioEnhancement: (enabled: boolean) => void;
  setAudioPreset: (preset: AudioPresetId) => void;
  setAudioGraphStatus: (status: AudioGraphStatus) => void;
  setAudioMeter: (meter: MusicAudioMeter) => void;
  setLyricOffset: (offset: number) => void;
  resetLyricOffset: () => void;
  setStatus: (status: MusicStatus, error?: string | null) => void;
  setProgress: (currentTime: number, duration: number) => void;
  setVolume: (volume: number) => void;
  setConsoleOpen: (open: boolean) => void;
}

export const useMusicStore = create<MusicState>((set) => ({
  track: null,
  queue: [],
  uploads: [],
  queueIndex: -1,
  status: 'idle',
  error: null,
  currentTime: 0,
  duration: 0,
  volume: 0.72,
  playbackMode: 'queue',
  autoMix: false,
  fadeInDuration: 0.46,
  fadeOutDuration: 0.42,
  audioEnhancement: true,
  audioPreset: 'studio-master-v1',
  audioGraphStatus: 'idle',
  audioMeter: {
    samplePeakDbfs: -120,
    truePeakDbtp: null,
    compressorReductionDb: 0,
    limiterReductionDb: 0,
    clipping: false,
  },
  lyricOffset: 0,
  consoleOpen: false,
  setTrack: (track) => {
    const nextTrack = track ? normalizedTrack(track) : null;
    set({
      track: nextTrack,
      status: nextTrack ? 'ready' : 'idle',
      error: null,
      currentTime: 0,
      duration: 0,
    });
  },
  setQueue: (queue) => set({ queue: queue.map(normalizedTrack), queueIndex: queue.length > 0 ? 0 : -1 }),
  playQueueTrack: (queue, index) => {
    const nextQueue = queue.map(normalizedTrack);
    const nextTrack = nextQueue[index];
    set({
      queue: nextQueue,
      queueIndex: nextTrack ? index : -1,
      track: nextTrack ?? null,
      status: nextTrack ? 'ready' : 'idle',
      error: null,
      currentTime: 0,
      duration: 0,
    });
  },
  enqueueTrack: (track) =>
    set((state) => {
      const nextTrack = normalizedTrack(track);
      if (state.queue.some((item) => item.id === nextTrack.id)) return state;
      const nextQueue = [...state.queue, nextTrack];
      return {
        queue: nextQueue,
        queueIndex: state.queueIndex >= 0 ? state.queueIndex : nextQueue.length - 1,
      };
    }),
  addUploadedTrack: (track) =>
    set((state) => {
      const nextTrack = normalizedTrack({ ...track, source: 'upload' });
      if (state.uploads.some((item) => item.id === nextTrack.id)) return state;
      return { uploads: [...state.uploads, nextTrack] };
    }),
  removeUploadedTrack: (trackId) =>
    set((state) => ({ uploads: state.uploads.filter((item) => item.id !== trackId) })),
  removeQueueTrack: (index) =>
    set((state) => {
      if (index < 0 || index >= state.queue.length) return state;
      const nextQueue = state.queue.filter((_, itemIndex) => itemIndex !== index);
      if (nextQueue.length === 0) {
        return {
          queue: [],
          queueIndex: -1,
          track: null,
          status: 'idle' as MusicStatus,
          currentTime: 0,
          duration: 0,
        };
      }
      const nextIndex = state.queueIndex > index
        ? state.queueIndex - 1
        : state.queueIndex === index
          ? Math.min(index, nextQueue.length - 1)
          : state.queueIndex;
      if (state.queueIndex !== index) return { queue: nextQueue, queueIndex: nextIndex };
      const nextTrack = nextQueue[nextIndex] ?? null;
      return {
        queue: nextQueue,
        queueIndex: nextIndex,
        track: nextTrack,
        status: nextTrack ? ('ready' as MusicStatus) : ('idle' as MusicStatus),
        currentTime: 0,
        duration: 0,
      };
    }),
  moveQueueTrackNext: (index) =>
    set((state) => {
      const movingTrack = state.queue[index];
      if (!movingTrack || state.queueIndex === index) return state;
      const remaining = state.queue.filter((_, itemIndex) => itemIndex !== index);
      const currentTrackId = state.track?.id;
      const currentIndex = currentTrackId ? remaining.findIndex((item) => item.id === currentTrackId) : -1;
      const insertIndex = currentIndex >= 0 ? currentIndex + 1 : remaining.length;
      const nextQueue = [
        ...remaining.slice(0, insertIndex),
        movingTrack,
        ...remaining.slice(insertIndex),
      ];
      return {
        queue: nextQueue,
        queueIndex: currentTrackId ? nextQueue.findIndex((item) => item.id === currentTrackId) : state.queueIndex,
      };
    }),
  playNextTrack: () =>
    set((state) => {
      const nextIndex = state.queueIndex + 1;
      const nextTrack = state.queue[nextIndex];
      if (!nextTrack) return { status: 'paused', currentTime: 0 };
      return {
        queueIndex: nextIndex,
        track: nextTrack,
        status: 'ready',
        error: null,
        currentTime: 0,
        duration: 0,
      };
    }),
  cyclePlaybackMode: () =>
    set((state) => ({
      playbackMode: state.playbackMode === 'queue' ? 'repeat' : state.playbackMode === 'repeat' ? 'shuffle' : 'queue',
    })),
  setAutoMix: (autoMix) => set({ autoMix }),
  setFadeInDuration: (duration) => set({ fadeInDuration: Math.min(3, Math.max(0, duration)) }),
  setFadeOutDuration: (duration) => set({ fadeOutDuration: Math.min(3, Math.max(0, duration)) }),
  setAudioEnhancement: (audioEnhancement) => set({
    audioEnhancement,
    audioPreset: audioEnhancement ? 'studio-master-v1' : 'original',
  }),
  setAudioPreset: (audioPreset) => set({
    audioPreset,
    audioEnhancement: audioPreset !== 'original',
  }),
  setAudioGraphStatus: (audioGraphStatus) => set({ audioGraphStatus }),
  setAudioMeter: (audioMeter) => set({ audioMeter }),
  setLyricOffset: (lyricOffset) => set({ lyricOffset: Math.min(10, Math.max(-10, lyricOffset)) }),
  resetLyricOffset: () => set({ lyricOffset: 0 }),
  setStatus: (status, error = null) => set({ status, error }),
  setProgress: (currentTime, duration) => set({ currentTime, duration }),
  setVolume: (volume) => set({ volume: Math.min(1, Math.max(0, volume)) }),
  setConsoleOpen: (consoleOpen) => set({ consoleOpen }),
}));
