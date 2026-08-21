import { create } from 'zustand';

import type { AudioPresetId } from '../features/music/audioPresets';

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
  /** Runtime timestamp for expiring remote playback URLs. */
  streamResolvedAt?: number;
  /** Runtime-only local source used by deterministic offline export. */
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

interface MusicState {
  track: MusicTrack | null;
  queue: MusicTrack[];
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
  energy: number;
  bass: number;
  mid: number;
  treble: number;
  beat: number;
  consoleOpen: boolean;
  setTrack: (track: MusicTrack | null) => void;
  setTrackSource: (trackId: string, src: string, streamResolvedAt?: number) => void;
  setQueue: (queue: MusicTrack[]) => void;
  playQueueTrack: (queue: MusicTrack[], index: number) => void;
  enqueueTrack: (track: MusicTrack) => void;
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
  setTrackSource: (trackId, src, streamResolvedAt = Date.now()) =>
    set((state) => {
      const nextQueue = state.queue.map((item) => (
        item.id === trackId ? { ...item, src, streamResolvedAt } : item
      ));
      if (!state.track || state.track.id !== trackId) {
        return { queue: nextQueue };
      }
      return {
        track: { ...state.track, src, streamResolvedAt },
        queue: nextQueue,
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
      // Preserve the queue item's ownership.  Local files can be queued too;
      // forcing every queue item to `remote` made template playback ask the
      // network for a blob URL that only existed locally.
      track: nextTrack ? { ...nextTrack, source: nextTrack.source ?? 'remote' } : null,
      status: nextTrack ? 'ready' : 'idle',
      error: null,
      currentTime: 0,
      duration: 0,
    });
  },
  enqueueTrack: (track) =>
    set((state) => {
      if (state.queue.some((item) => item.id === track.id)) return state;
      const nextQueue = [...state.queue, { ...track, source: track.source ?? 'remote' }];
      return {
        queue: nextQueue,
        queueIndex: state.queueIndex >= 0 ? state.queueIndex : nextQueue.length - 1,
      };
    }),
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
      const nextIndex =
        state.queueIndex > index
          ? state.queueIndex - 1
          : state.queueIndex === index
            ? Math.min(index, nextQueue.length - 1)
            : state.queueIndex;
      if (state.queueIndex !== index) return { queue: nextQueue, queueIndex: nextIndex };
      const nextTrack = nextQueue[nextIndex] ?? null;
      return {
        queue: nextQueue,
        queueIndex: nextIndex,
        track: nextTrack ? { ...nextTrack, source: nextTrack.source ?? 'remote' } : null,
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
        track: { ...nextTrack, source: nextTrack.source ?? 'remote' },
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
  setSpectrum: (spectrum) => set(spectrum),
  setConsoleOpen: (consoleOpen) => set({ consoleOpen }),
}));
