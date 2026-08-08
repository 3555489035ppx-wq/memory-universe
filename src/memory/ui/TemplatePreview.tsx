import { useEffect, useMemo, useRef, type ReactNode } from 'react';

import { getMemoryTemplate } from '../config';
import { FallbackPlaybackClock } from '../engine/FallbackPlaybackClock';
import { MemoryPlaybackCoordinator } from '../engine/MemoryPlaybackCoordinator';
import { useMemoryTemplateStore } from '../../stores/memoryTemplateStore';
import { useMusicStore } from '../../stores/musicStore';

function formatTime(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

export function TemplatePreview(): ReactNode {
  const session = useMemoryTemplateStore((state) => state.session);
  const start = useMemoryTemplateStore((state) => state.start);
  const pause = useMemoryTemplateStore((state) => state.pause);
  const resume = useMemoryTemplateStore((state) => state.resume);
  const seek = useMemoryTemplateStore((state) => state.seek);
  const replay = useMemoryTemplateStore((state) => state.replay);
  const exit = useMemoryTemplateStore((state) => state.exit);
  const musicStatus = useMusicStore((state) => state.status);
  const musicCurrentTime = useMusicStore((state) => state.currentTime);
  const musicDuration = useMusicStore((state) => state.duration);
  const fallbackClock = useRef<FallbackPlaybackClock | null>(null);

  const templateId = session?.templateId ?? null;
  const config = useMemo(() => (templateId ? getMemoryTemplate(templateId) : null), [templateId]);
  const activePhase = useMemo(() => {
    if (!session || !config) return null;
    return config.phases.find((phase, index) => session.progress < phase.end || index === config.phases.length - 1) ?? null;
  }, [config, session]);
  const usingMusicClock = musicStatus === 'playing' && musicDuration > 0;
  const sessionStatus = session?.status ?? 'idle';
  const sessionTemplateId = templateId;

  useEffect(() => {
    if (!sessionTemplateId || !config || usingMusicClock || sessionStatus !== 'playing') {
      fallbackClock.current?.pause();
      return;
    }
    const clock = fallbackClock.current ?? new FallbackPlaybackClock(config.durationSeconds);
    fallbackClock.current = clock;
    const coordinator = new MemoryPlaybackCoordinator(clock, sessionTemplateId);
    coordinator.connect();
    clock.seek(useMemoryTemplateStore.getState().session?.progress ?? 0);
    clock.play();
    return () => {
      coordinator.disconnect();
    };
  }, [config, seek, sessionStatus, sessionTemplateId, usingMusicClock]);

  useEffect(() => {
    if (!sessionTemplateId || !usingMusicClock || musicDuration <= 0) return;
    seek(Math.min(1, Math.max(0, musicCurrentTime / musicDuration)));
  }, [musicCurrentTime, musicDuration, seek, sessionTemplateId, usingMusicClock]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      const active = useMemoryTemplateStore.getState().session;
      if (!active) return;
      if (event.key === 'Escape') {
        exit();
      } else if (event.key === ' ') {
        event.preventDefault();
        if (active.status === 'playing') pause();
        else if (active.status === 'paused' || active.status === 'preview') start();
      } else if (event.key === 'ArrowLeft') {
        seek(active.progress - 0.05);
      } else if (event.key === 'ArrowRight') {
        seek(active.progress + 0.05);
      } else if (event.key.toLowerCase() === 'r' && active.status === 'completed') {
        replay();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [exit, pause, replay, seek, start]);

  if (!session || !config || session.status === 'error') {
    if (!session || !config) return null;
    return (
      <section className="memory-template-preview memory-template-preview--error" role="alert" data-testid="template-preview">
        <strong>{session.error ?? '模板暂时无法打开'}</strong>
        <button type="button" onClick={exit}>返回宇宙</button>
      </section>
    );
  }

  const progressPercent = `${String(Math.round(session.progress * 100))}%`;
  const statusLabel = session.status === 'playing' ? '正在播放' : session.status === 'paused' ? '已暂停' : session.status === 'completed' ? '播放完成' : '预览中';

  return (
    <section className="memory-template-preview" aria-labelledby="template-preview-title" data-testid="template-preview">
      <div className="memory-template-preview__copy">
        <p className="eyebrow">{config.category}</p>
        <h2 id="template-preview-title">{config.title}</h2>
        <p>{config.description}</p>
        <span className="memory-template-preview__status" role="status" aria-live="polite">
          {statusLabel} · {activePhase?.label ?? '准备'}
        </span>
      </div>
      <div className="memory-template-preview__controls">
        <div className="memory-template-preview__meta">
          <span>{session.memoryIds.length} 张照片</span>
          <span>{formatTime(config.durationSeconds)}</span>
        </div>
        <label className="memory-template-preview__seek">
          <span className="sr-only">播放进度</span>
          <input
            type="range"
            min="0"
            max="100"
            value={Math.round(session.progress * 100)}
            onChange={(event) => {
              const next = Number(event.target.value) / 100;
              seek(next);
              fallbackClock.current?.seek(next);
            }}
            aria-label={`播放进度 ${progressPercent}`}
          />
        </label>
        <div className="memory-template-preview__buttons">
          {session.status === 'preview' && <button type="button" onClick={start}>开始回忆</button>}
          {session.status === 'playing' && <button type="button" onClick={() => { pause(); fallbackClock.current?.pause(); }}>暂停</button>}
          {session.status === 'paused' && <button type="button" onClick={() => { resume(); fallbackClock.current?.play(); }}>继续</button>}
          {session.status === 'completed' && <button type="button" onClick={() => { replay(); fallbackClock.current?.seek(0); fallbackClock.current?.play(); }}>重播</button>}
          <button type="button" className="secondary" onClick={exit}>退出模板</button>
        </div>
      </div>
    </section>
  );
}
