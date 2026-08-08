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

import { getMusicStream } from './musicService';
import { useMusicStore, type MusicStatus } from '../../stores/musicStore';

function formatTime(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '00:00';
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
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

export function MusicExperience(): ReactNode {
  const location = useLocation();
  const audioRef = useRef<HTMLAudioElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const previousEnergyRef = useRef(0);
  const {
    track,
    queue,
    queueIndex,
    status,
    error,
    currentTime,
    duration,
    volume,
    consoleOpen,
    setTrack,
    setTrackSource,
    setStatus,
    setProgress,
    setVolume,
    setSpectrum,
    setConsoleOpen,
    playNextTrack,
  } = useMusicStore();
  const isHome = location.pathname === '/';
  const [dragActive, setDragActive] = useState(false);

  const ensureAudioGraph = useCallback((): AudioContext | null => {
    const audio = audioRef.current;
    if (!audio) return null;
    const browserWindow = window as unknown as {
      AudioContext?: typeof AudioContext;
      webkitAudioContext?: typeof AudioContext;
    };
    const AudioContextConstructor = browserWindow.AudioContext ?? browserWindow.webkitAudioContext;
    if (!AudioContextConstructor) return null;
    if (!audioContextRef.current) {
      const context = new AudioContextConstructor();
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.84;
      const source = context.createMediaElementSource(audio);
      source.connect(analyser);
      analyser.connect(context.destination);
      audioContextRef.current = context;
      analyserRef.current = analyser;
      sourceNodeRef.current = source;
    }
    return audioContextRef.current;
  }, []);

  const openFilePicker = useCallback(() => inputRef.current?.click(), []);

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
    const audio = audioRef.current;
    if (!audio || !track) return;
    let cancelled = false;
    const loadSource = async (): Promise<void> => {
      if (track.source === 'remote' && !track.src) {
        setStatus('loading');
        try {
          const stream = await getMusicStream(track);
          if (cancelled) return;
          const nextSrc = stream.proxiedUrl || stream.url;
          setTrackSource(track.id, nextSrc);
          audio.src = nextSrc;
          audio.load();
        } catch (reason: unknown) {
          if (cancelled) return;
          setStatus('error', reason instanceof Error ? reason.message : '播放地址获取失败。');
        }
        return;
      }
      if (audio.src !== track.src) {
        audio.src = track.src;
        audio.load();
      }
    };
    void loadSource();
    return () => {
      cancelled = true;
    };
  }, [setStatus, setTrackSource, track]);

  const togglePlayback = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !track) {
      openFilePicker();
      return;
    }
    if (status === 'loading' || (track.source === 'remote' && !track.src)) return;
    const context = ensureAudioGraph();
    if (context?.state === 'suspended') void context.resume();
    if (audio.paused) {
      void audio.play().then(
        () => setStatus('playing'),
        () => setStatus('error', '浏览器阻止了播放，请再次点击播放。'),
      );
    } else {
      audio.pause();
      setStatus('paused');
    }
  }, [ensureAudioGraph, openFilePicker, setStatus, status, track]);

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
      if (audio) audio.volume = nextVolume;
      setVolume(nextVolume);
    },
    [setVolume],
  );

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.volume = volume;
  }, [volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onLoadedMetadata = (): void => setProgress(audio.currentTime, audio.duration || 0);
    const onTimeUpdate = (): void => setProgress(audio.currentTime, audio.duration || 0);
    const onEnded = (): void => {
      if (queueIndex >= 0 && queueIndex < queue.length - 1) {
        playNextTrack();
        return;
      }
      setStatus('paused');
      setProgress(0, audio.duration || 0);
    };
    const onError = (): void => setStatus('error', '这段音乐无法播放，请换一首或换一个音质。');
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);
    return () => {
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
  }, [playNextTrack, queue.length, queueIndex, setProgress, setStatus]);

  useEffect(() => {
    if (status !== 'playing') {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      setSpectrum({ energy: 0, bass: 0, mid: 0, treble: 0, beat: 0 });
      previousEnergyRef.current = 0;
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
      setSpectrum({ energy, bass, mid, treble, beat });
      rafRef.current = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [setSpectrum, status]);

  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      sourceNodeRef.current?.disconnect();
      analyserRef.current?.disconnect();
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

  return (
    <section
      className={`music-experience ${isHome ? 'music-experience--hero' : 'music-experience--dock'}`}
      aria-label="音乐与节奏视觉"
    >
      <audio ref={audioRef} preload="metadata" crossOrigin="anonymous" aria-hidden="true" />
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
        <div className="music-console__topline">
          <div>
            <p className="eyebrow">{providerLabel(track?.provider)}</p>
            <p className="music-console__status" role="status">
              {statusLabel(status, track)}
            </p>
          </div>
          <button
            className="music-console__toggle"
            type="button"
            aria-expanded={consoleOpen}
            onClick={() => setConsoleOpen(!consoleOpen)}
          >
            {consoleOpen ? '收起' : '展开'}
          </button>
        </div>
        <div className="music-console__trackline">
          {!isHome && (
            <button
              className="music-console__play music-console__play--inline"
              type="button"
              aria-label={status === 'playing' ? '暂停音乐' : track ? '播放音乐' : '选择音乐'}
              onClick={togglePlayback}
            >
              {status === 'playing' ? 'Ⅱ' : '▶'}
            </button>
          )}
          <div className="music-console__track" title={track?.fileName ?? '还没有选择音乐'}>
            {track?.cover ? (
              <img className="music-console__track-art" src={track.cover} alt="" />
            ) : (
              <span className="music-console__track-dot" aria-hidden="true" />
            )}
            <span className="music-console__track-copy">
              <strong>{trackTitle}</strong>
              {trackSubtitle && <small>{trackSubtitle}</small>}
            </span>
          </div>
          <button className="music-console__choose" type="button" onClick={openFilePicker}>
            {track ? '换一段' : '选择音乐'}
          </button>
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
