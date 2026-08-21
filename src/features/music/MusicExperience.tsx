import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type DragEvent,
  type ReactNode,
} from 'react';
import { useLocation } from 'react-router-dom';
import {
  ArrowsClockwiseIcon as ArrowsClockwise,
  CornersOutIcon as CornersOut,
  HeartIcon as Heart,
  ListIcon as List,
  PauseIcon as Pause,
  PlayIcon as Play,
  PlusIcon as Plus,
  RepeatIcon as Repeat,
  ShuffleIcon as Shuffle,
  SkipBackIcon as SkipBack,
  SkipForwardIcon as SkipForward,
  SpeakerHighIcon as SpeakerHigh,
  SpeakerSlashIcon as SpeakerSlash,
  WaveformIcon as Waveform,
} from '@phosphor-icons/react';

import { getMusicStream, invalidateMusicStream } from './musicService';
import { MusicArtwork } from './MusicArtwork';
import { HIGH_SCHOOL_DEMO_TRACK } from './demoMusic';
import { StudioAudioGraph } from './audioEnhancement';
import { AUDIO_PRESETS, type AudioPresetId } from './audioPresets';
import {
  playAudioWithContext,
  shouldQueuePlaybackUntilReady,
  shouldRefreshRemoteStream,
} from './audioPlayback';
import { useMusicStore, type MusicStatus, type MusicTrack, type PlaybackMode } from '../../stores/musicStore';
import { useMemoryTemplateStore } from '../../stores/memoryTemplateStore';
import { GlassButton } from '../../components/ui/glass-button';
import { useUiStore } from '../../stores/uiStore';

function formatTime(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '00:00';
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatDecibels(value: number | null): string {
  if (value === null || !Number.isFinite(value) || value <= -100) return '−∞ dB';
  return `${value > 0 ? '+' : ''}${value.toFixed(1)} dB`;
}

function statusLabel(status: MusicStatus, track: { source?: 'local' | 'remote' } | null): string {
  if (!track) return '选择一段本地音乐，或从歌单开始';
  if (status === 'loading') return '正在连接音乐服务';
  if (status === 'playing') return '正在随节奏呼吸';
  if (status === 'paused') return '已暂停 · 节奏保留';
  if (status === 'error') return '无法读取这段音乐';
  return track.source === 'remote' ? '已连接 · 等待播放' : '已准备 · 等待播放';
}

function providerLabel(provider?: 'netease' | 'qq'): string {
  if (provider === 'qq') return 'QQ MUSIC';
  if (provider === 'netease') return 'NETEASE';
  return 'LOCAL SOUNDTRACK';
}

function averageRange(data: Uint8Array, start: number, end: number): number {
  const safeStart = Math.max(0, Math.min(data.length, Math.floor(start)));
  const safeEnd = Math.max(safeStart + 1, Math.min(data.length, Math.floor(end)));
  let total = 0;
  for (let index = safeStart; index < safeEnd; index += 1) total += data[index] ?? 0;
  return total / (safeEnd - safeStart) / 255;
}

function isAudioFile(file: File): boolean {
  return file.type.startsWith('audio/') || /\.(mp3|wav|m4a|aac|ogg|flac|webm)$/i.test(file.name);
}

const FAVORITES_STORAGE_KEY = 'memuniverse:music-favorites';

function playbackModeLabel(mode: PlaybackMode): string {
  if (mode === 'repeat') return '单曲循环';
  if (mode === 'shuffle') return '随机播放';
  return '顺序播放';
}

function PlaybackModeIcon({ mode }: { mode: PlaybackMode }): ReactNode {
  if (mode === 'repeat') return <Repeat aria-hidden="true" size={18} weight="regular" />;
  if (mode === 'shuffle') return <Shuffle aria-hidden="true" size={18} weight="regular" />;
  return <ArrowsClockwise aria-hidden="true" size={18} weight="regular" />;
}

function getStoredFavoriteIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = JSON.parse(window.localStorage.getItem(FAVORITES_STORAGE_KEY) ?? '[]') as unknown;
    return Array.isArray(stored) ? stored.filter((value): value is string => typeof value === 'string') : [];
  } catch {
    return [];
  }
}

export function MusicExperience(): ReactNode {
  const location = useLocation();
  const audioRef = useRef<HTMLAudioElement>(null);
  const volumePopoverRef = useRef<HTMLDivElement>(null);
  const queuePopoverRef = useRef<HTMLDivElement>(null);
  const lyricsPopoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioGraphRef = useRef<StudioAudioGraph | null>(null);
  const previousVolumeRef = useRef(0.72);
  const rafRef = useRef<number | null>(null);
  const fadeRafRef = useRef<number | null>(null);
  const fadeCompletionRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeOutScheduledRef = useRef(false);
  const previousEnergyRef = useRef(0);
  const lastSpectrumPublishRef = useRef(0);
  const pendingTemplateCueRef = useRef<number | null>(null);
  const pendingAutoPlayRef = useRef(false);
  const playbackIntentRef = useRef(false);
  const remoteRecoveryRef = useRef({ trackId: '', attempts: 0, recovering: false });
  const {
    track,
    queue,
    queueIndex,
    status,
    error,
    currentTime,
    duration,
    volume,
    playbackMode,
    autoMix,
    fadeInDuration,
    fadeOutDuration,
    audioPreset,
    audioGraphStatus,
    audioMeter,
    lyricOffset,
    consoleOpen,
    setTrack,
    setTrackSource,
    setStatus,
    setProgress,
    setVolume,
    setSpectrum,
    setConsoleOpen,
    playQueueTrack,
    enqueueTrack,
    removeQueueTrack,
    moveQueueTrackNext,
    cyclePlaybackMode,
    setAutoMix,
    setFadeInDuration,
    setFadeOutDuration,
    setAudioPreset,
    setAudioGraphStatus,
    setAudioMeter,
    setLyricOffset,
    resetLyricOffset,
  } = useMusicStore();
  const immersiveOpen = useUiStore((state) => state.immersiveOpen);
  const setImmersiveOpen = useUiStore((state) => state.setImmersiveOpen);
  const pushToast = useUiStore((state) => state.pushToast);
  const isHome = location.pathname === '/';
  const [dragActive, setDragActive] = useState(false);
  const [volumeOpen, setVolumeOpen] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const [bufferedProgress, setBufferedProgress] = useState(0);
  const [favoriteIds, setFavoriteIds] = useState<string[]>(getStoredFavoriteIds);
  const [auditionOriginal, setAuditionOriginal] = useState(false);

  const applyAudioPreset = useCallback((preset: AudioPresetId): void => {
    audioGraphRef.current?.setPreset(preset);
  }, []);

  const ensureAudioGraph = useCallback((): AudioContext | null => {
    const audio = audioRef.current;
    if (!audio) return null;
    const browserWindow = window as unknown as {
      AudioContext?: typeof AudioContext;
      webkitAudioContext?: typeof AudioContext;
    };
    const AudioContextConstructor = browserWindow.AudioContext ?? browserWindow.webkitAudioContext;
    if (!AudioContextConstructor) {
      setAudioGraphStatus('error');
      return null;
    }
    if (!audioContextRef.current) {
      try {
        const context = new AudioContextConstructor({ sampleRate: 48_000 });
        const graph = new StudioAudioGraph(context, audio);
        graph.setPreset(audioPreset, true);
        graph.setOutputGain(volume, 0.01);
        audio.volume = 1;
        audioContextRef.current = context;
        audioGraphRef.current = graph;
        analyserRef.current = graph.analyser;
        setAudioGraphStatus('loading');
        void graph
          .initializeLimiter(new URL('./studioLimiter.worklet.ts', import.meta.url))
          .then((limiterStatus) => setAudioGraphStatus(limiterStatus === 'ready' ? 'ready' : 'fallback'));
      } catch {
        setAudioGraphStatus('error');
        audioContextRef.current = null;
        audioGraphRef.current = null;
        analyserRef.current = null;
        return null;
      }
    }
    return audioContextRef.current;
  }, [audioPreset, setAudioGraphStatus, volume]);

  const refreshRemoteTrack = useCallback(
    async (candidate: MusicTrack, autoPlay: boolean, forceRefresh = false): Promise<void> => {
      if (candidate.source !== 'remote') return;
      if (autoPlay) {
        playbackIntentRef.current = true;
        pendingAutoPlayRef.current = true;
      }
      if (forceRefresh) invalidateMusicStream(candidate);
      setStatus('loading');
      try {
        const stream = await getMusicStream(candidate);
        if (useMusicStore.getState().track?.id !== candidate.id) return;
        const nextSrc = stream.proxiedUrl || stream.url;
        const resolvedAt = Date.now();
        setTrackSource(candidate.id, nextSrc, resolvedAt);
        const audio = audioRef.current;
        if (!audio) return;
        audio.src = nextSrc;
        audio.load();
      } catch (reason: unknown) {
        if (useMusicStore.getState().track?.id !== candidate.id) return;
        pendingAutoPlayRef.current = false;
        playbackIntentRef.current = false;
        setStatus('error', reason instanceof Error ? reason.message : '播放地址获取失败。');
      }
    },
    [setStatus, setTrackSource],
  );

  const recoverRemotePlayback = useCallback(
    (candidate: MusicTrack, autoPlay: boolean): boolean => {
      if (candidate.source !== 'remote') return false;
      const recovery = remoteRecoveryRef.current;
      if (recovery.trackId !== candidate.id) {
        remoteRecoveryRef.current = { trackId: candidate.id, attempts: 0, recovering: false };
      }
      const activeRecovery = remoteRecoveryRef.current;
      if (activeRecovery.recovering) return true;
      if (activeRecovery.attempts >= 1) return false;
      activeRecovery.attempts += 1;
      activeRecovery.recovering = true;
      void refreshRemoteTrack(candidate, autoPlay, true).finally(() => {
        const latest = remoteRecoveryRef.current;
        if (latest.trackId === candidate.id) latest.recovering = false;
      });
      return true;
    },
    [refreshRemoteTrack],
  );

  const openFilePicker = useCallback(() => inputRef.current?.click(), []);

  const cancelAudioFade = useCallback((): void => {
    if (fadeRafRef.current !== null) cancelAnimationFrame(fadeRafRef.current);
    if (fadeCompletionRef.current !== null) clearTimeout(fadeCompletionRef.current);
    fadeRafRef.current = null;
    fadeCompletionRef.current = null;
    audioGraphRef.current?.cancelOutputAutomation();
  }, []);

  const fadeAudio = useCallback(
    (targetVolume: number, seconds: number, onComplete?: () => void): void => {
      const audio = audioRef.current;
      cancelAudioFade();
      const graph = audioGraphRef.current;
      const target = Math.min(1, Math.max(0, targetVolume));
      if (graph) {
        if (audio) audio.volume = 1;
        if (seconds <= 0) graph.setOutputGain(target, 0.01);
        else graph.rampOutputGain(target, seconds);
        if (onComplete) {
          fadeCompletionRef.current = setTimeout(() => {
            fadeCompletionRef.current = null;
            onComplete();
          }, Math.max(0, seconds) * 1_000);
        }
        return;
      }
      if (!audio || seconds <= 0) {
        if (audio) audio.volume = target;
        onComplete?.();
        return;
      }
      const startVolume = audio.volume;
      const startedAt = typeof performance === 'undefined' ? Date.now() : performance.now();
      const tick = (now: number): void => {
        const elapsed = Math.max(0, now - startedAt) / 1000;
        const progress = Math.min(1, elapsed / seconds);
        const eased = 1 - Math.pow(1 - progress, 2);
        audio.volume = startVolume + (target - startVolume) * eased;
        if (progress < 1) {
          fadeRafRef.current = requestAnimationFrame(tick);
        } else {
          fadeRafRef.current = null;
          audio.volume = target;
          onComplete?.();
        }
      };
      fadeRafRef.current = requestAnimationFrame(tick);
    },
    [cancelAudioFade],
  );

  const startPlayback = useCallback(
    (withFadeIn = false): void => {
      const audio = audioRef.current;
      if (!audio) return;
      if (audio.ended || (Number.isFinite(audio.duration) && audio.duration > 0 && audio.currentTime >= audio.duration - 0.05)) {
        const cueSeconds = pendingTemplateCueRef.current ?? 0;
        audio.currentTime = Math.min(cueSeconds, Number.isFinite(audio.duration) ? audio.duration : cueSeconds);
        pendingTemplateCueRef.current = null;
      }
      playbackIntentRef.current = true;
      const context = ensureAudioGraph();
      const graph = audioGraphRef.current;
      const targetVolume = volume;
      const shouldFade = withFadeIn && autoMix && fadeInDuration > 0 && targetVolume > 0;
      if (shouldFade) {
        cancelAudioFade();
        if (graph) {
          audio.volume = 1;
          graph.setOutputGain(0, 0.01);
        } else {
          audio.volume = 0;
        }
      } else {
        if (graph) {
          audio.volume = 1;
          graph.setOutputGain(targetVolume, 0.04);
        } else {
          audio.volume = targetVolume;
        }
      }
      void playAudioWithContext(audio, context).then(
        () => {
          setStatus('playing');
          if (shouldFade) fadeAudio(targetVolume, fadeInDuration);
        },
        (reason: unknown) => {
          const errorName = reason && typeof reason === 'object' && 'name' in reason
            ? String((reason as { name?: unknown }).name)
            : '';
          if (errorName === 'NotAllowedError') {
            playbackIntentRef.current = false;
            setStatus('ready');
            pushToast('浏览器需要一次点击才能播放，音源已准备好，请再次点击播放。', 'neutral', 5000);
            return;
          }
          if (track && recoverRemotePlayback(track, true)) return;
          playbackIntentRef.current = false;
          setStatus('error', '播放失败，请检查音乐连接、播放地址或更换音质。');
        },
      );
    },
    [autoMix, cancelAudioFade, ensureAudioGraph, fadeAudio, fadeInDuration, pushToast, recoverRemotePlayback, setStatus, track, volume],
  );

  const toggleQueue = useCallback((): void => {
    setQueueOpen((value) => !value);
    setVolumeOpen(false);
    setLyricsOpen(false);
  }, []);

  const toggleLyrics = useCallback((): void => {
    setLyricsOpen((value) => !value);
    setQueueOpen(false);
    setVolumeOpen(false);
  }, []);

  const handleFavorite = useCallback((): void => {
    if (!track) return;
    const nextFavoriteIds = favoriteIds.includes(track.id)
      ? favoriteIds.filter((id) => id !== track.id)
      : [...favoriteIds, track.id];
    setFavoriteIds(nextFavoriteIds);
    try {
      window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(nextFavoriteIds));
    } catch {
      // Favorites still work for the current session when storage is unavailable.
    }
    pushToast(nextFavoriteIds.includes(track.id) ? '已收藏这首歌' : '已取消收藏', 'success');
  }, [favoriteIds, pushToast, track]);

  const addCurrentToQueue = useCallback((): void => {
    if (!track) return;
    const alreadyQueued = queue.some((item) => item.id === track.id);
    enqueueTrack(track);
    pushToast(alreadyQueued ? '这首歌已经在当前队列' : '已加入当前队列', 'success');
  }, [enqueueTrack, pushToast, queue, track]);

  const cycleMode = useCallback((): void => {
    const nextMode: PlaybackMode = playbackMode === 'queue' ? 'repeat' : playbackMode === 'repeat' ? 'shuffle' : 'queue';
    cyclePlaybackMode();
    pushToast(playbackModeLabel(nextMode), 'neutral', 1400);
  }, [cyclePlaybackMode, playbackMode, pushToast]);

  const adjustLyricOffset = useCallback((delta: number): void => {
    const nextOffset = Math.round((lyricOffset + delta) * 10) / 10;
    setLyricOffset(nextOffset);
  }, [lyricOffset, setLyricOffset]);

  const playPreviousTrack = useCallback((): void => {
    const audio = audioRef.current;
    if (audio && currentTime > 3) {
      audio.currentTime = 0;
      setProgress(0, audio.duration || duration);
      return;
    }
    if (queueIndex > 0) {
      pendingAutoPlayRef.current = true;
      playQueueTrack(queue, queueIndex - 1);
    }
  }, [currentTime, duration, playQueueTrack, queue, queueIndex, setProgress]);

  const toggleMute = useCallback((): void => {
    if (volume > 0) {
      previousVolumeRef.current = volume;
      setVolume(0);
    } else {
      setVolume(Math.max(0.1, previousVolumeRef.current));
    }
  }, [setVolume, volume]);

  const setAuditionBypass = useCallback((enabled: boolean): void => {
    setAuditionOriginal(enabled);
    audioGraphRef.current?.setAuditionBypass(enabled);
  }, []);

  const playNextFromUser = useCallback((): void => {
    if (queue.length === 0) return;
    const nextIndex = queueIndex >= 0 ? (queueIndex + 1) % queue.length : 0;
    if (nextIndex === queueIndex && audioRef.current) {
      audioRef.current.currentTime = 0;
      startPlayback(true);
      return;
    }
    pendingAutoPlayRef.current = true;
    playQueueTrack(queue, nextIndex);
  }, [playQueueTrack, queue, queueIndex, startPlayback]);

  const toggleImmersive = useCallback((): void => {
    setVolumeOpen(false);
    setQueueOpen(false);
    setLyricsOpen(false);
    setConsoleOpen(false);
    const nextImmersiveOpen = !immersiveOpen;
    setImmersiveOpen(nextImmersiveOpen);

    // The existing immersive state removes the app chrome. Pair it with the
    // browser Fullscreen API so the scene can also occupy the whole window
    // when the user explicitly presses the control.
    if (nextImmersiveOpen) {
      void document.documentElement
        .requestFullscreen({ navigationUI: 'hide' })
        .catch(() => undefined);
    } else if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
    }
  }, [immersiveOpen, setConsoleOpen, setImmersiveOpen]);

  const loadFile = useCallback(
    (file: File): void => {
      if (!isAudioFile(file)) {
        setStatus('error', '请选择音频文件。');
        return;
      }
      const audio = audioRef.current;
      if (!audio) return;
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      const src = URL.createObjectURL(file);
      objectUrlRef.current = src;
      audio.src = src;
      audio.load();
      setTrack({
        id: `${file.name}-${String(file.lastModified)}-${String(file.size)}`,
        name: file.name.replace(/\.[^/.]+$/, ''),
        fileName: file.name,
        src,
        source: 'local',
        localFile: file,
      });
    },
    [setStatus, setTrack],
  );

  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (file) loadFile(file);
    },
    [loadFile],
  );

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((event: DragEvent<HTMLDivElement>): void => {
    if (event.currentTarget === event.target) setDragActive(false);
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>): void => {
      event.preventDefault();
      setDragActive(false);
      const file = event.dataTransfer.files[0];
      if (file) loadFile(file);
    },
    [loadFile],
  );

  useEffect(() => {
    const openLocalPicker = (): void => {
      setConsoleOpen(true);
      openFilePicker();
    };
    window.addEventListener('memuniverse:music-library-select', openLocalPicker);
    return () => window.removeEventListener('memuniverse:music-library-select', openLocalPicker);
  }, [openFilePicker, setConsoleOpen]);

  useEffect(() => {
    const parameters = new URLSearchParams(location.search);
    if (
      location.pathname !== '/universe'
      || parameters.get('source') !== 'demo'
      || parameters.get('demo') !== 'high-school'
      || useMusicStore.getState().track
    ) return;
    // The demo is complete on first open: it has a local, redistributable
    // soundtrack and never requires a login or a network request. A user who
    // already chose music keeps that choice, including when returning from a
    // personal template.
    setTrack(HIGH_SCHOOL_DEMO_TRACK);
  }, [location.pathname, location.search, setTrack]);

  useEffect(() => {
    if (!location.pathname.startsWith('/universe')) {
      if (immersiveOpen) setImmersiveOpen(false);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    }
  }, [immersiveOpen, location.pathname, setImmersiveOpen]);

  useEffect(() => {
    const handleFullscreenChange = (): void => {
      // Keep the scene-only website state aligned with the browser Fullscreen
      // API, including a user pressing Escape or leaving fullscreen from the
      // browser chrome. The Windows taskbar itself is outside the page and is
      // hidden only by real browser fullscreen, never by page CSS.
      setImmersiveOpen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [setImmersiveOpen]);

  useEffect(() => {
    applyAudioPreset(audioPreset);
  }, [applyAudioPreset, audioPreset]);

  useEffect(() => {
    fadeOutScheduledRef.current = false;
    cancelAudioFade();
  }, [cancelAudioFade, track?.id]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent): void => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (volumePopoverRef.current && !volumePopoverRef.current.contains(target)) setVolumeOpen(false);
      if (queuePopoverRef.current && !queuePopoverRef.current.contains(target)) setQueueOpen(false);
      if (lyricsPopoverRef.current && !lyricsPopoverRef.current.contains(target)) setLyricsOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      if (immersiveOpen) {
        event.preventDefault();
        setImmersiveOpen(false);
        if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
        return;
      }
      if (volumeOpen) {
        event.preventDefault();
        setVolumeOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [immersiveOpen, setImmersiveOpen, volumeOpen]);

  useEffect(() => {
    const applyCue = (cueSeconds: number): void => {
      const audio = audioRef.current;
      if (!audio || !Number.isFinite(cueSeconds) || cueSeconds < 0) return;
      pendingTemplateCueRef.current = cueSeconds;
      if (audio.readyState >= 1) {
        audio.currentTime = Math.min(cueSeconds, Number.isFinite(audio.duration) ? audio.duration : cueSeconds);
        setProgress(audio.currentTime, audio.duration || duration);
      }
    };
    const handleTemplateTrackRequest = (event: Event): void => {
      const detail = (event as CustomEvent<{ cueSeconds?: unknown }>).detail;
      const cueSeconds = typeof detail.cueSeconds === 'number' ? detail.cueSeconds : 0;
      applyCue(cueSeconds);
      setConsoleOpen(true);
    };
    const handleTemplateSeek = (event: Event): void => {
      const detail = (event as CustomEvent<{ progress?: unknown; cueSeconds?: unknown; durationSeconds?: unknown }>).detail;
      const progress = detail.progress;
      const cueSeconds = typeof detail.cueSeconds === 'number' && Number.isFinite(detail.cueSeconds)
        ? Math.max(0, detail.cueSeconds)
        : 0;
      const safeProgress = typeof progress === 'number' && Number.isFinite(progress)
        ? Math.min(1, Math.max(0, progress))
        : null;
      const audio = audioRef.current;
      if (safeProgress === null || !audio || !track || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
      const requestedDuration = typeof detail.durationSeconds === 'number' && Number.isFinite(detail.durationSeconds)
        ? Math.max(0, detail.durationSeconds)
        : audio.duration - cueSeconds;
      const cueDuration = Math.max(0, Math.min(audio.duration - cueSeconds, requestedDuration));
      audio.currentTime = Math.min(audio.duration, cueSeconds + safeProgress * cueDuration);
      setProgress(audio.currentTime, audio.duration);
    };
    const handleTemplateReplay = (event: Event): void => {
      const detail = (event as CustomEvent<{ cueSeconds?: unknown }>).detail;
      const cueSeconds = typeof detail.cueSeconds === 'number' && Number.isFinite(detail.cueSeconds)
        ? Math.max(0, detail.cueSeconds)
        : 0;
      applyCue(cueSeconds);
      const audio = audioRef.current;
      if (!audio || !track) return;
      playbackIntentRef.current = true;
      if (audio.paused || audio.ended) startPlayback(true);
    };
    window.addEventListener('memuniverse:template-track-request', handleTemplateTrackRequest);
    window.addEventListener('memuniverse:template-seek', handleTemplateSeek);
    window.addEventListener('memuniverse:template-replay', handleTemplateReplay);
    return () => {
      window.removeEventListener('memuniverse:template-track-request', handleTemplateTrackRequest);
      window.removeEventListener('memuniverse:template-seek', handleTemplateSeek);
      window.removeEventListener('memuniverse:template-replay', handleTemplateReplay);
    };
  }, [duration, setConsoleOpen, setProgress, setStatus, startPlayback, track]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !track) return;
    const loadSource = (): void => {
      if (shouldRefreshRemoteStream(track)) {
        void refreshRemoteTrack(track, pendingAutoPlayRef.current);
        return;
      }
      if (audio.src !== track.src) {
        audio.src = track.src;
        audio.load();
      }
    };
    loadSource();
  }, [refreshRemoteTrack, track]);

  useEffect(() => {
    remoteRecoveryRef.current = { trackId: track?.id ?? '', attempts: 0, recovering: false };
  }, [track?.id]);

  const togglePlayback = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !track) {
      openFilePicker();
      return;
    }
    if (status === 'error' && track.source === 'remote') {
      remoteRecoveryRef.current = { trackId: track.id, attempts: 0, recovering: false };
      const context = ensureAudioGraph();
      if (context?.state === 'suspended') void context.resume().catch(() => undefined);
      recoverRemotePlayback(track, true);
      return;
    }
    if (shouldQueuePlaybackUntilReady({ source: track.source, src: track.src, status })) {
      const alreadyPending = pendingAutoPlayRef.current;
      pendingAutoPlayRef.current = true;
      const context = ensureAudioGraph();
      if (context?.state === 'suspended') void context.resume().catch(() => undefined);
      setStatus('loading');
      if (!alreadyPending) pushToast('音乐准备完成后会自动播放。', 'neutral', 1800);
      return;
    }

    if (audio.paused) {
      startPlayback(autoMix);
    } else {
      cancelAudioFade();
      playbackIntentRef.current = false;
      audio.pause();
      setStatus('paused');
    }
  }, [autoMix, cancelAudioFade, ensureAudioGraph, openFilePicker, pushToast, recoverRemotePlayback, setStatus, startPlayback, status, track]);

  const handleSeek = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const audio = audioRef.current;
      if (!audio) return;
      const nextTime = Number(event.target.value);
      audio.currentTime = nextTime;
      setProgress(nextTime, audio.duration || duration);
    },
    [duration, setProgress],
  );

  const handleVolume = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const nextVolume = Number(event.target.value);
      const audio = audioRef.current;
      cancelAudioFade();
      if (audioGraphRef.current) {
        if (audio) audio.volume = 1;
        audioGraphRef.current.setOutputGain(nextVolume);
      } else if (audio) {
        audio.volume = nextVolume;
      }
      setVolume(nextVolume);
    },
    [cancelAudioFade, setVolume],
  );

  useEffect(() => {
    const audio = audioRef.current;
    if (audioGraphRef.current) {
      if (audio) audio.volume = 1;
      audioGraphRef.current.setOutputGain(volume);
    } else if (audio) {
      audio.volume = volume;
    }
  }, [volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onProgress = (): void => {
      if (!Number.isFinite(audio.duration) || audio.duration <= 0 || audio.buffered.length === 0) return;
      const bufferedEnd = audio.buffered.end(audio.buffered.length - 1);
      setBufferedProgress(Math.min(100, Math.max(0, (bufferedEnd / audio.duration) * 100)));
    };
    const onLoadedMetadata = (): void => {
      if (pendingTemplateCueRef.current !== null) {
        audio.currentTime = Math.min(pendingTemplateCueRef.current, audio.duration || pendingTemplateCueRef.current);
        pendingTemplateCueRef.current = null;
      }
      setProgress(audio.currentTime, audio.duration || 0);
      onProgress();
      if (pendingAutoPlayRef.current) {
        pendingAutoPlayRef.current = false;
        startPlayback(true);
      }
    };
    const onTimeUpdate = (): void => {
      setProgress(audio.currentTime, audio.duration || 0);
      if (
        autoMix &&
        queue.length > 1 &&
        Number.isFinite(audio.duration) &&
        audio.duration > 0 &&
        fadeOutDuration > 0 &&
        !fadeOutScheduledRef.current &&
        audio.duration - audio.currentTime <= fadeOutDuration
      ) {
        fadeOutScheduledRef.current = true;
        fadeAudio(0, fadeOutDuration);
      }
    };
    const onEnded = (): void => {
      cancelAudioFade();
      fadeOutScheduledRef.current = false;
      if (audioGraphRef.current) {
        audio.volume = 1;
        audioGraphRef.current.setOutputGain(volume, 0.01);
      } else {
        audio.volume = volume;
      }
      const activeTemplate = useMemoryTemplateStore.getState().session;
      if (activeTemplate) {
        // A template owns the end of its soundtrack. Do not let the generic
        // music-player loop restart the audio behind a completed photo film;
        // that left the second pass with a moving audio clock and paused
        // photo integrators. The explicit replay path resets both together.
        useMemoryTemplateStore.getState().complete();
        playbackIntentRef.current = false;
        pendingAutoPlayRef.current = false;
        setStatus('paused');
        setProgress(audio.duration || 0, audio.duration || 0);
        return;
      }
      if (playbackMode === 'repeat' && track) {
        audio.currentTime = 0;
        startPlayback(true);
        return;
      }
      if (playbackMode === 'shuffle' && queue.length > 1) {
        const candidates = queue.map((_, index) => index).filter((index) => index !== queueIndex);
        const nextIndex = candidates[Math.floor(Math.random() * candidates.length)] ?? 0;
        pendingAutoPlayRef.current = true;
        playQueueTrack(queue, nextIndex);
        return;
      }
      if (queue.length > 1) {
        const nextIndex = queueIndex >= 0 && queueIndex < queue.length - 1 ? queueIndex + 1 : 0;
        pendingAutoPlayRef.current = true;
        playQueueTrack(queue, nextIndex);
        return;
      }
      if (track) {
        audio.currentTime = 0;
        startPlayback(true);
        return;
      }
      setStatus('paused');
      setProgress(0, audio.duration || 0);
    };
    const onError = (): void => {
      const shouldResume = playbackIntentRef.current || pendingAutoPlayRef.current;
      if (track && recoverRemotePlayback(track, shouldResume)) return;
      pendingAutoPlayRef.current = false;
      playbackIntentRef.current = false;
      setStatus('error', '这段音乐无法播放，请换一首或换一个音质。');
    };
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('progress', onProgress);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);
    return () => {
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('progress', onProgress);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
  }, [autoMix, cancelAudioFade, fadeAudio, fadeOutDuration, playQueueTrack, playbackMode, queue, queueIndex, recoverRemotePlayback, setProgress, setStatus, setBufferedProgress, startPlayback, track, volume]);

  useEffect(() => {
    if (status !== 'playing') {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      setSpectrum({ energy: 0, bass: 0, mid: 0, treble: 0, beat: 0 });
      setAudioMeter({
        samplePeakDbfs: -120,
        truePeakDbtp: null,
        compressorReductionDb: 0,
        limiterReductionDb: 0,
        clipping: false,
      });
      previousEnergyRef.current = 0;
      lastSpectrumPublishRef.current = 0;
      return;
    }
    const analyser = analyserRef.current;
    if (!analyser) return;
    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = (): void => {
      analyser.getByteFrequencyData(data);
      const bass = averageRange(data, 0, data.length * 0.18);
      const mid = averageRange(data, data.length * 0.18, data.length * 0.62);
      const treble = averageRange(data, data.length * 0.62, data.length);
      const energy = bass * 0.52 + mid * 0.33 + treble * 0.15;
      const previous = previousEnergyRef.current;
      const beat = energy > 0.18 && energy > previous * 1.16 ? Math.min(1, energy * 1.8) : 0;
      previousEnergyRef.current = previous * 0.82 + energy * 0.18;
      // Keep the analyser at frame rate, but publish the shared snapshot at a
      // bounded cadence so React controls do not re-render on every frame.
      const now = typeof performance === 'undefined' ? Date.now() : performance.now();
      if (beat > 0 || now - lastSpectrumPublishRef.current >= 80) {
        lastSpectrumPublishRef.current = now;
        setSpectrum({ energy, bass, mid, treble, beat });
        const meter = audioGraphRef.current?.readMeter();
        if (meter) {
          setAudioMeter({
            samplePeakDbfs: meter.samplePeakDbfs,
            truePeakDbtp: meter.truePeakDbtp,
            compressorReductionDb: meter.compressorReductionDb,
            limiterReductionDb: meter.limiterReductionDb,
            clipping: meter.clipping,
          });
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [setAudioMeter, setSpectrum, status]);

  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (fadeRafRef.current !== null) cancelAnimationFrame(fadeRafRef.current);
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      if (fadeCompletionRef.current !== null) clearTimeout(fadeCompletionRef.current);
      audioGraphRef.current?.dispose();
      audioGraphRef.current = null;
      analyserRef.current = null;
      void audioContextRef.current?.close();
    },
    [],
  );

  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const consoleClass = isHome
    ? 'music-console music-console--hero'
    : 'music-console music-console--dock';
  const trackTitle = track?.name ?? 'Memuniverse';
  const trackSubtitle = track?.artist || (track?.source === 'remote' ? providerLabel(track.provider) : track?.fileName);
  const selectedAudioPreset = AUDIO_PRESETS[audioPreset];
  const displayedPeak = audioMeter.truePeakDbtp ?? audioMeter.samplePeakDbfs;
  const audioGraphLabel = audioGraphStatus === 'ready'
    ? '4× 峰值保护已就绪'
    : audioGraphStatus === 'loading'
      ? '正在准备峰值保护'
      : audioGraphStatus === 'fallback'
        ? '实时兼容保护 · 导出仍使用离线 4×'
        : audioGraphStatus === 'error'
          ? '处理不可用，播放已回退原声'
          : '播放后建立本地处理链';

  return (
    <section
      className={`music-experience ${isHome ? 'music-experience--hero' : 'music-experience--dock'}`}
      aria-label="音乐与节奏视觉"
    >
      <audio ref={audioRef} preload="auto" crossOrigin="anonymous" aria-hidden="true" />
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept="audio/*,.flac,.m4a,.mp3,.wav,.ogg,.webm"
        onChange={handleFileChange}
      />
      <div
        className={consoleClass}
        data-open={consoleOpen || undefined}
        data-drag-active={dragActive || undefined}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {dragActive && <p className="music-console__drop-note">松开以导入音频</p>}
        <div className="music-console__reference" data-playing={status === 'playing' || undefined}>
          <div className="music-console__reference-progress">
            <input
              type="range"
              min="0"
              max={duration || 0}
              step="0.1"
              value={Math.min(currentTime, duration || 0)}
              onChange={handleSeek}
              disabled={!track || duration <= 0}
              aria-label="音乐进度"
              data-playing={status === 'playing' || undefined}
              style={{
                '--range-progress': `${String(progress)}%`,
                '--range-buffered': `${String(bufferedProgress)}%`,
              } as CSSProperties}
            />
          </div>
          <div className="music-console__reference-main">
            <div className="music-console__reference-track" title={track?.fileName ?? '还没有选择音乐'}>
              <MusicArtwork
                src={track?.cover}
                label={track?.name || '当前音乐'}
                className="music-console__reference-art"
                fallbackClassName="music-console__reference-art music-console__reference-art--empty"
              />
              <span className="music-console__reference-copy">
                <strong>{trackTitle}</strong>
                <small>{trackSubtitle || '等待选择音乐'}</small>
                <span>{providerLabel(track?.provider)}</span>
              </span>
            </div>

            <div className="music-console__reference-center" aria-label="播放控制">
              <div className="music-console__reference-actions">
                <GlassButton
                  className="music-console__inline-button-wrap music-console__reference-control-wrap"
                  buttonClassName="music-console__reference-control music-console__reference-control--favorite"
                  size="icon"
                  strength="subtle"
                  type="button"
                  aria-label={favoriteIds.includes(track?.id ?? '') ? '取消收藏' : '收藏'}
                  aria-pressed={favoriteIds.includes(track?.id ?? '')}
                  disabled={!track}
                  onClick={handleFavorite}
                >
                  <Heart
                    aria-hidden="true"
                    size={19}
                    weight={favoriteIds.includes(track?.id ?? '') ? 'fill' : 'regular'}
                  />
                </GlassButton>
                <GlassButton
                  className="music-console__inline-button-wrap music-console__reference-control-wrap"
                  buttonClassName="music-console__reference-control music-console__reference-control--add"
                  size="icon"
                  strength="subtle"
                  type="button"
                  aria-label="加入当前队列"
                  disabled={!track}
                  onClick={addCurrentToQueue}
                >
                  <Plus aria-hidden="true" size={19} weight="regular" />
                </GlassButton>
                <GlassButton
                  className="music-console__inline-button-wrap music-console__reference-control-wrap"
                  buttonClassName="music-console__reference-control music-console__reference-control--mode"
                  size="icon"
                  strength="subtle"
                  type="button"
                  aria-label={playbackModeLabel(playbackMode)}
                  data-mode={playbackMode}
                  onClick={cycleMode}
                >
                  <PlaybackModeIcon mode={playbackMode} />
                </GlassButton>
                <GlassButton
                  className="music-console__inline-button-wrap music-console__reference-control-wrap"
                  buttonClassName="music-console__reference-control music-console__reference-control--automix"
                  size="icon"
                  strength="subtle"
                  type="button"
                  aria-label="Cuefield AutoMix"
                  aria-pressed={autoMix}
                  onClick={() => {
                    setAutoMix(!autoMix);
                    pushToast(!autoMix ? 'AutoMix 已开启' : 'AutoMix 已关闭', 'neutral', 1400);
                  }}
                >
                  <Waveform aria-hidden="true" size={19} weight="regular" />
                </GlassButton>
              </div>
              <div className="music-console__transport">
                <GlassButton
                  className="music-console__inline-button-wrap music-console__reference-control-wrap"
                  buttonClassName="music-console__reference-control music-console__reference-control--previous"
                  size="icon"
                  strength="subtle"
                  type="button"
                  aria-label="上一首"
                  disabled={queueIndex <= 0 && currentTime <= 3}
                  onClick={playPreviousTrack}
                >
                  <SkipBack aria-hidden="true" size={17} weight="fill" />
                </GlassButton>
                <GlassButton
                  className="music-console__inline-button-wrap music-console__reference-control-wrap music-console__reference-play-wrap"
                  buttonClassName="music-console__reference-play"
                  size="icon"
                  strength="medium"
                  type="button"
                  aria-label={status === 'playing' ? '暂停音乐' : status === 'loading' ? '音乐加载中，点击后自动播放' : track ? '播放音乐' : '选择音乐后播放'}
                  disabled={!track}
                  onPointerEnter={() => {
                    if (track) ensureAudioGraph();
                  }}
                  onFocus={() => {
                    if (track) ensureAudioGraph();
                  }}
                  onClick={togglePlayback}
                >
                  {status === 'playing' ? (
                    <Pause aria-hidden="true" size={24} weight="fill" />
                  ) : (
                    <Play aria-hidden="true" size={24} weight="fill" />
                  )}
                </GlassButton>
                <GlassButton
                  className="music-console__inline-button-wrap music-console__reference-control-wrap"
                  buttonClassName="music-console__reference-control music-console__reference-control--next"
                  size="icon"
                  strength="subtle"
                  type="button"
                  aria-label="下一首"
                  disabled={queue.length === 0}
                  onClick={playNextFromUser}
                >
                  <SkipForward aria-hidden="true" size={17} weight="fill" />
                </GlassButton>
              </div>
              <div ref={queuePopoverRef} className="music-console__queue-control">
                <GlassButton
                  className="music-console__inline-button-wrap music-console__reference-control-wrap"
                  buttonClassName="music-console__reference-control music-console__reference-control--queue"
                  size="icon"
                  strength="subtle"
                  type="button"
                  aria-label="打开当前队列"
                  aria-expanded={queueOpen}
                  onClick={toggleQueue}
                >
                  <List aria-hidden="true" size={20} weight="regular" />
                </GlassButton>
                {queueOpen && (
                  <div className="music-console__queue-popover" role="dialog" aria-label="当前队列">
                    <header>
                      <div>
                        <strong>当前队列</strong>
                        <span>{queue.length} 首 · {track?.name || '等待播放'}</span>
                      </div>
                      <button type="button" onClick={() => setQueueOpen(false)} aria-label="关闭当前队列">×</button>
                    </header>
                    {queue.length > 0 ? (
                      <div className="music-console__queue-list">
                        {queue.map((queueTrack: MusicTrack, index) => (
                          <div className={`music-console__queue-row ${queueIndex === index ? 'is-active' : ''}`} key={`${queueTrack.id}-${String(index)}`}>
                            <button
                              className="music-console__queue-row-main"
                              type="button"
                              onClick={() => {
                                pendingAutoPlayRef.current = true;
                                playQueueTrack(queue, index);
                              }}
                            >
                              <MusicArtwork
                                src={queueTrack.cover}
                                label={queueTrack.name}
                                className="music-console__queue-cover"
                                fallbackClassName="music-console__queue-cover-fallback"
                                priority={index < 8}
                              />
                              <span>
                                <strong>{queueTrack.name}</strong>
                                <small>{queueTrack.artist || queueTrack.fileName}</small>
                              </span>
                            </button>
                            <div className="music-console__queue-row-actions">
                              <button type="button" onClick={() => moveQueueTrackNext(index)} aria-label="下一首播放">↓</button>
                              <button type="button" onClick={() => removeQueueTrack(index)} aria-label="移除歌曲">×</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="music-console__queue-empty">从音乐库选择歌曲，或加入一段本地音频。</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="music-console__utilities" aria-label="播放器工具">
              <div ref={lyricsPopoverRef} className="music-console__lyrics-control">
                <GlassButton
                  className="music-console__inline-button-wrap music-console__reference-control-wrap"
                  buttonClassName="music-console__reference-control music-console__reference-control--lyrics"
                  size="icon"
                  strength="subtle"
                  type="button"
                  aria-label="歌词校准"
                  aria-expanded={lyricsOpen}
                  onClick={toggleLyrics}
                >
                  <span className="music-console__lyrics-mark" aria-hidden="true">词</span>
                </GlassButton>
                {lyricsOpen && (
                  <div className="music-console__lyrics-popover" role="dialog" aria-label="歌词校准">
                    <strong>歌词校准</strong>
                    <span>{track?.name || '当前没有歌曲'}</span>
                    <div className="music-console__lyrics-adjust">
                      <button type="button" onClick={() => adjustLyricOffset(-0.1)} aria-label="歌词提前 0.1 秒">−0.1</button>
                      <output>{lyricOffset >= 0 ? '+' : ''}{lyricOffset.toFixed(1)}s</output>
                      <button type="button" onClick={() => adjustLyricOffset(0.1)} aria-label="歌词延后 0.1 秒">+0.1</button>
                    </div>
                    <button className="music-console__lyrics-reset" type="button" onClick={resetLyricOffset}>重置</button>
                  </div>
                )}
              </div>
              <div ref={volumePopoverRef} className="music-console__volume-control">
                <GlassButton
                  className="music-console__volume-button-wrap"
                  buttonClassName="music-console__reference-control music-console__reference-control--volume"
                  size="icon"
                  strength="subtle"
                  type="button"
                  aria-label={volume > 0 ? '静音' : '取消静音'}
                  aria-expanded={volumeOpen}
                  onClick={() => {
                    setVolumeOpen((value) => !value);
                    setQueueOpen(false);
                    setLyricsOpen(false);
                  }}
                >
                  {volume === 0 ? (
                    <SpeakerSlash aria-hidden="true" size={19} weight="regular" />
                  ) : (
                    <SpeakerHigh aria-hidden="true" size={19} weight="regular" />
                  )}
                </GlassButton>
                {volumeOpen && (
                  <div className="music-console__volume-popover" role="dialog" aria-label="音量设置">
                    <div className="music-console__volume-popover-heading">
                      <strong>声音</strong>
                      <output>{Math.round(volume * 100)}%</output>
                    </div>
                    <label className="music-console__volume-setting">
                      <span>主音量</span>
                      <output>{Math.round(volume * 100)}%</output>
                      <input type="range" min="0" max="1" step="0.01" value={volume} onChange={handleVolume} aria-label="主音量" />
                    </label>
                    <label className="music-console__volume-setting">
                      <span>淡入</span>
                      <output>{fadeInDuration.toFixed(2)}s</output>
                      <input type="range" min="0" max="3" step="0.01" value={fadeInDuration} onChange={(event) => setFadeInDuration(Number(event.target.value))} aria-label="淡入时长" />
                    </label>
                    <label className="music-console__volume-setting">
                      <span>淡出</span>
                      <output>{fadeOutDuration.toFixed(2)}s</output>
                      <input type="range" min="0" max="3" step="0.01" value={fadeOutDuration} onChange={(event) => setFadeOutDuration(Number(event.target.value))} aria-label="淡出时长" />
                    </label>
                    <div className="music-console__processing" aria-label="音频处理">
                      <div className="music-console__processing-heading">
                        <strong>音频处理</strong>
                        <span data-status={audioGraphStatus}>{audioGraphLabel}</span>
                      </div>
                      <div className="music-console__preset-group" role="group" aria-label="音频处理预设">
                        {(['original', 'clarity-v1', 'studio-master-v1'] as const).map((presetId) => (
                          <button
                            key={presetId}
                            type="button"
                            aria-pressed={audioPreset === presetId}
                            onClick={() => {
                              if (presetId === 'original' && auditionOriginal) setAuditionBypass(false);
                              setAudioPreset(presetId);
                            }}
                          >
                            {AUDIO_PRESETS[presetId].label}
                          </button>
                        ))}
                      </div>
                      <p className="music-console__processing-description">{selectedAudioPreset.description}</p>
                      <div className="music-console__meter" data-clipping={audioMeter.clipping || undefined}>
                        <span>峰值 <output>{formatDecibels(displayedPeak)}</output></span>
                        <span>动态控制 <output>{audioMeter.compressorReductionDb.toFixed(1)} dB</output></span>
                        <span>限制 <output>{audioMeter.limiterReductionDb.toFixed(1)} dB</output></span>
                      </div>
                      <button
                        className="music-console__ab-audition"
                        type="button"
                        aria-pressed={auditionOriginal}
                        disabled={audioPreset === 'original' || audioGraphStatus === 'error'}
                        onPointerDown={(event) => {
                          event.currentTarget.setPointerCapture(event.pointerId);
                          setAuditionBypass(true);
                        }}
                        onPointerUp={() => setAuditionBypass(false)}
                        onPointerCancel={() => setAuditionBypass(false)}
                        onBlur={() => setAuditionBypass(false)}
                        onKeyDown={(event) => {
                          if (event.key === ' ' || event.key === 'Enter') setAuditionBypass(true);
                        }}
                        onKeyUp={(event) => {
                          if (event.key === ' ' || event.key === 'Enter') setAuditionBypass(false);
                        }}
                      >
                        {auditionOriginal ? '正在试听原声' : '按住 A/B 试听原声'}
                      </button>
                      {track?.source === 'remote' && (
                        <p className="music-console__processing-note">远程歌曲可实时处理；导出时会通过本机连接器临时下载并用当前母带预设写入 4K MP4。</p>
                      )}
                    </div>
                    <button className="music-console__volume-mute" type="button" aria-pressed={volume === 0} onClick={toggleMute}>
                      {volume === 0 ? '取消静音' : '静音'}
                    </button>
                  </div>
                )}
              </div>
              <GlassButton
                className="music-console__inline-button-wrap music-console__reference-control-wrap"
                buttonClassName="music-console__reference-control music-console__reference-control--fullscreen"
                size="icon"
                strength="subtle"
                type="button"
                aria-label={immersiveOpen ? '退出全沉浸式' : '全沉浸式'}
                aria-pressed={immersiveOpen}
                onClick={toggleImmersive}
              >
                <CornersOut aria-hidden="true" size={19} weight="regular" />
              </GlassButton>
              <span className="music-console__reference-time" aria-label="播放时间">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>
          </div>
        </div>
        <div className="music-console__topline">
          <div>
            <p className="eyebrow">{providerLabel(track?.provider)}</p>
            <p className="music-console__status" role="status">
              {statusLabel(status, track)}
            </p>
          </div>
          <GlassButton
            className="music-console__inline-button-wrap"
            buttonClassName="music-console__toggle"
            size="sm"
            strength="subtle"
            type="button"
            aria-expanded={consoleOpen}
            onClick={() => setConsoleOpen(!consoleOpen)}
          >
            {consoleOpen ? '收起' : '展开'}
          </GlassButton>
        </div>
        <div className="music-console__trackline">
          {!isHome && (
            <GlassButton
              className="music-console__inline-button-wrap"
              buttonClassName="music-console__play music-console__play--inline"
              size="icon"
              strength="medium"
              type="button"
              aria-label={status === 'playing' ? '暂停音乐' : track ? '播放音乐' : '选择音乐'}
              onPointerEnter={() => {
                if (track) ensureAudioGraph();
              }}
              onFocus={() => {
                if (track) ensureAudioGraph();
              }}
              onClick={togglePlayback}
            >
              {status === 'playing' ? 'Ⅱ' : '▶'}
            </GlassButton>
          )}
          <div className="music-console__track" title={track?.fileName ?? '还没有选择音乐'}>
            <MusicArtwork
              src={track?.cover}
              label={track?.name || '当前音乐'}
              className="music-console__track-art"
              fallbackClassName="music-console__track-dot"
            />
            <span className="music-console__track-copy">
              <strong>{trackTitle}</strong>
              {trackSubtitle && <small>{trackSubtitle}</small>}
            </span>
          </div>
          <GlassButton
            className="music-console__inline-button-wrap"
            buttonClassName="music-console__choose"
            size="sm"
            strength="subtle"
            type="button"
            onClick={openFilePicker}
          >
            {track ? '换一段' : '选择音乐'}
          </GlassButton>
        </div>
        <div className="music-console__wave" aria-hidden="true">
          {Array.from({ length: 18 }, (_, index) => (
            <span
              key={index}
              style={
                {
                  '--wave-delay': `${String(index * 34)}ms`,
                  '--wave-height': `${String(34 + ((index * 17) % 50))}%`,
                } as CSSProperties
              }
            />
          ))}
        </div>
        {consoleOpen && (
          <div className="music-console__controls">
            <label className="music-console__range">
              <span>{formatTime(currentTime)}</span>
              <input
                type="range"
                min="0"
                max={duration || 0}
                step="0.1"
                value={Math.min(currentTime, duration || 0)}
                onChange={handleSeek}
                disabled={!track || duration <= 0}
                aria-label="音乐进度"
                style={{ '--range-progress': `${String(progress)}%` } as CSSProperties}
              />
              <span>{formatTime(duration)}</span>
            </label>
            <label className="music-console__volume">
              <span aria-hidden="true">音量</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={handleVolume}
                aria-label="音量"
              />
              <output>{Math.round(volume * 100)}%</output>
            </label>
          </div>
        )}
        {error && (
          <p className="music-console__error" role="alert">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
