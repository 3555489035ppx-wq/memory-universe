import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';

import { getMemoryTemplate, resolveTemplateConfig } from '../config';
import { FallbackPlaybackClock } from '../engine/FallbackPlaybackClock';
import { MemoryPlaybackCoordinator } from '../engine/MemoryPlaybackCoordinator';
import { buildSongTimelineConfig, songTimelineProgress } from '../engine/SongTimeline';
import { useMemoryTemplateStore } from '../../stores/memoryTemplateStore';
import { useMusicStore } from '../../stores/musicStore';
import { VideoExportDialog } from '../../features/export/VideoExportDialog';

function formatTime(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

export function TemplatePreview(): ReactNode {
  const session = useMemoryTemplateStore((state) => state.session);
  const start = useMemoryTemplateStore((state) => state.start);
  const pause = useMemoryTemplateStore((state) => state.pause);
  const seek = useMemoryTemplateStore((state) => state.seek);
  const replay = useMemoryTemplateStore((state) => state.replay);
  const complete = useMemoryTemplateStore((state) => state.complete);
  const exit = useMemoryTemplateStore((state) => state.exit);
  const musicStatus = useMusicStore((state) => state.status);
  const musicTrack = useMusicStore((state) => state.track);
  const musicCurrentTime = useMusicStore((state) => state.currentTime);
  const musicDuration = useMusicStore((state) => state.duration);
  const setConsoleOpen = useMusicStore((state) => state.setConsoleOpen);
  const fallbackClock = useRef<FallbackPlaybackClock | null>(null);

  const templateId = session?.templateId ?? null;
  const baseConfig = useMemo(
    () => (templateId ? resolveTemplateConfig(getMemoryTemplate(templateId), session?.overrides) : null),
    [session?.overrides, templateId],
  );
  const usingMusicClock = musicStatus === 'playing' && musicDuration > 0;
  const musicCueStart = musicTrack?.id ? session?.overrides?.songCueMap?.[musicTrack.id] ?? 0 : 0;
  const songDuration = musicDuration > musicCueStart ? musicDuration - musicCueStart : baseConfig?.durationSeconds ?? 0;
  const config = useMemo(
    () => (baseConfig ? buildSongTimelineConfig(baseConfig, songDuration) : null),
    [baseConfig, songDuration],
  );
  const replayTemplate = useCallback((): void => {
    replay();
    window.dispatchEvent(new CustomEvent('memuniverse:template-replay', {
      detail: { cueSeconds: musicCueStart },
    }));
  }, [musicCueStart, replay]);
  const activePhase = useMemo(() => {
    if (!session || !config) return null;
    return config.phases.find((phase, index) => session.progress < phase.end || index === config.phases.length - 1) ?? null;
  }, [config, session]);
  // A selected song is intentionally user-owned: pressing "开始" does not
  // steal autoplay or silently start it. The timeline waits until the player
  // is actually playing, while a failed source can still fall back to silence.
  const waitingForSelectedMusic = Boolean(musicTrack) && !usingMusicClock && musicStatus !== 'error';
  const sessionStatus = session?.status ?? 'idle';
  const sessionTemplateId = templateId;

  useEffect(() => {
    if (!sessionTemplateId) return;
    const cueSeconds = musicTrack?.id ? session?.overrides?.songCueMap?.[musicTrack.id] : undefined;
    window.dispatchEvent(
      new CustomEvent('memuniverse:template-track-request', {
        detail: { templateId: sessionTemplateId, cueSeconds },
      }),
    );
  }, [musicTrack?.id, session?.overrides?.songCueMap, sessionTemplateId]);

  // Playing a user-selected track is the explicit gesture that starts a
  // template. This keeps Preview silent while still making the intended flow
  // direct: choose a template, choose a system/upload track, press Play, and
  // the same audio clock starts the photo choreography.
  useEffect(() => {
    if (sessionStatus === 'preview' && usingMusicClock) start();
  }, [sessionStatus, start, usingMusicClock]);

  useEffect(() => {
    if (!sessionTemplateId || !config || usingMusicClock || waitingForSelectedMusic || sessionStatus !== 'playing') {
      fallbackClock.current?.pause();
      return;
    }
    const clock = new FallbackPlaybackClock(config.durationSeconds);
    fallbackClock.current = clock;
    const coordinator = new MemoryPlaybackCoordinator(clock, sessionTemplateId);
    // Restore the current position before publishing the first snapshot. A
    // completed clock from a previous template run must never be allowed to
    // immediately complete the newly prepared session.
    clock.seek(useMemoryTemplateStore.getState().session?.progress ?? 0);
    coordinator.connect();
    clock.play();
    return () => {
      coordinator.disconnect();
      if (fallbackClock.current === clock) fallbackClock.current = null;
    };
  }, [config, seek, sessionStatus, sessionTemplateId, usingMusicClock, waitingForSelectedMusic]);

  useEffect(() => {
    if (!sessionTemplateId || !usingMusicClock || musicDuration <= 0) return;
    const nextProgress = songTimelineProgress({
      currentTime: musicCurrentTime,
      mediaDuration: musicDuration,
      cueStart: musicCueStart,
    });
    if (nextProgress >= 1) {
      if (sessionStatus !== 'completed') {
        complete();
      }
      return;
    }
    // If the audio element was started again after reaching the end, the
    // completed template must re-enter its playing state before accepting the
    // new media-clock samples. Otherwise the second pass updates progress
    // while the photo integrators remain paused.
    if (sessionStatus === 'completed') {
      replayTemplate();
      return;
    }
    seek(nextProgress);
  }, [complete, config?.durationSeconds, musicCurrentTime, musicCueStart, musicDuration, replayTemplate, seek, sessionStatus, sessionTemplateId, usingMusicClock]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      const active = useMemoryTemplateStore.getState().session;
      if (!active) return;
      if (event.key === 'Escape') exit();
      else if (event.key === ' ') {
        event.preventDefault();
        if (active.status === 'playing') pause();
        else if (active.status === 'paused' || active.status === 'preview') start();
      } else if (event.key === 'ArrowLeft') seek(active.progress - 0.05);
      else if (event.key === 'ArrowRight') seek(active.progress + 0.05);
      else if (event.key.toLowerCase() === 'r' && active.status === 'completed') replayTemplate();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [exit, pause, replayTemplate, seek, start]);

  if (!session || !config || session.status === 'error') {
    if (!session || !config) return null;
    return (
      <section className="memory-template-preview memory-template-preview--error" role="alert" data-testid="template-preview">
        <strong>{session.error ?? '这个模板暂时无法打开'}</strong>
        <button type="button" onClick={exit}>返回宇宙</button>
      </section>
    );
  }

  const progressPercent = `${String(Math.round(session.progress * 100))}%`;
  const statusLabel = session.status === 'playing'
    ? waitingForSelectedMusic ? '等待音乐播放' : '正在播放'
    : session.status === 'paused' ? '已暂停'
      : session.status === 'completed' ? '播放完成' : '预览中';

  return (
    <section className="memory-template-preview" aria-labelledby="template-preview-title" data-testid="template-preview">
      <div className="memory-template-preview__copy">
        <h2 id="template-preview-title">{config.title}</h2>
        <span className="memory-template-preview__status" role="status" aria-live="polite">
          {statusLabel} · {activePhase?.label ?? '准备'}
        </span>
      </div>
      <div className="memory-template-preview__controls">
        <div className="memory-template-preview__meta">
          <span>{session.memoryIds.length} 张照片</span>
          <span>{musicDuration > 0 ? formatTime(config.durationSeconds) : '整曲模式'}</span>
        </div>
        <label className="memory-template-preview__seek">
          <span className="sr-only">播放进度</span>
          <input
            type="range"
            min="0"
            max="100"
            step="0.1"
            value={Math.min(100, Number((session.progress * 100).toFixed(1)))}
            onChange={(event) => {
              const next = Number(event.target.value) / 100;
              seek(next);
              fallbackClock.current?.seek(next);
              window.dispatchEvent(new CustomEvent('memuniverse:template-seek', {
                detail: { progress: next, cueSeconds: musicCueStart, durationSeconds: config.durationSeconds },
              }));
            }}
            aria-label={`播放进度 ${progressPercent}`}
          />
        </label>
        <div className="memory-template-preview__buttons">
          <button
            type="button"
            className="secondary"
            onClick={() => {
              setConsoleOpen(true);
              window.dispatchEvent(new Event('memuniverse:music-library-open'));
            }}
          >
            更换音乐
          </button>
          {session.status === 'completed' && (
            <button type="button" className="secondary" onClick={replayTemplate}>
              再看一遍
            </button>
          )}
          <VideoExportDialog />
          <button type="button" className="secondary" onClick={exit}>退出模板</button>
        </div>
      </div>
    </section>
  );
}
