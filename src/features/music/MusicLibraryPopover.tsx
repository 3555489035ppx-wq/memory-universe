import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { GlassButton } from '../../components/ui/glass-button';
import { useMusicStore, type MusicTrack, type MusicTrackSource } from '../../stores/musicStore';
import { DEMO_MUSIC_TRACKS } from './demoMusic';
import { MusicArtwork } from './MusicArtwork';

type LibrarySource = 'system' | 'upload';
type LibraryView = 'library' | 'queue';

function formatTrackDuration(value = 0): string {
  const seconds = value > 1000 ? Math.floor(value / 1000) : Math.floor(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return '--:--';
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

export function Cover({
  src,
  label,
  source,
}: {
  src: string | undefined;
  label: string;
  source?: MusicTrackSource;
}): ReactNode {
  return (
    <MusicArtwork
      src={src}
      label={label}
      className="music-library__cover"
      fallbackClassName={`music-library__cover music-library__cover--${source ?? 'system'}`}
      fallbackText={source === 'upload' ? 'UP' : 'MU'}
    />
  );
}

function TrackRow({
  track,
  index,
  active,
  onPlay,
  onRemove,
}: {
  track: MusicTrack;
  index: number;
  active: boolean;
  onPlay: () => void;
  onRemove?: () => void;
}): ReactNode {
  return (
    <div className={`music-library__track-row ${active ? 'is-active' : ''}`}>
      <button className="music-library__track-button" type="button" onClick={onPlay} aria-label={`播放 ${track.name}`}>
        <Cover src={track.cover} label={track.name} source={track.source ?? 'system'} />
        <span className="music-library__track-number">{String(index + 1).padStart(2, '0')}</span>
        <span className="music-library__track-copy">
          <strong>{track.name}</strong>
          <small>
            {track.artist || track.album || track.fileName}
          </small>
        </span>
        <time>{formatTrackDuration(track.duration)}</time>
      </button>
      {onRemove && (
        <button className="music-library__track-remove" type="button" onClick={onRemove} aria-label={`移除 ${track.name}`}>
          ×
        </button>
      )}
    </div>
  );
}

export function MusicLibraryPopover(): ReactNode {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [source, setSource] = useState<LibrarySource>('system');
  const [view, setView] = useState<LibraryView>('library');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const {
    track,
    queue,
    queueIndex,
    uploads,
    playQueueTrack,
    setConsoleOpen,
    removeUploadedTrack,
  } = useMusicStore();

  const systemTracks = DEMO_MUSIC_TRACKS;
  const groupedSystemTracks = useMemo(() => {
    const groups = new Map<string, MusicTrack[]>();
    systemTracks.forEach((item) => {
      const category = item.category || '待修改分类';
      groups.set(category, [...(groups.get(category) ?? []), item]);
    });
    return [...groups.entries()];
  }, [systemTracks]);

  const closeLibrary = useCallback((): void => {
    setPinned(false);
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  useEffect(() => {
    const openLibrary = (): void => {
      setOpen(true);
      setView('library');
      setSource('upload');
    };
    window.addEventListener('memuniverse:music-library-open', openLibrary);
    return () => window.removeEventListener('memuniverse:music-library-open', openLibrary);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') closeLibrary();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeLibrary, open]);

  const playTracks = useCallback((tracks: readonly MusicTrack[], index: number): void => {
    const selectedTrack = tracks[index];
    if (!selectedTrack) return;
    playQueueTrack([...tracks], index);
    setConsoleOpen(true);
    setOpen(false);
  }, [playQueueTrack, setConsoleOpen]);

  const uploadAnotherTrack = useCallback((): void => {
    setSource('upload');
    setView('library');
    setConsoleOpen(true);
    window.dispatchEvent(new Event('memuniverse:music-library-select'));
  }, [setConsoleOpen]);

  const activeSourceTracks = source === 'system' ? systemTracks : uploads;

  return (
    <div className="music-library" data-open={open || undefined} data-pinned={pinned || undefined}>
      <GlassButton
        ref={triggerRef}
        className="music-library__trigger-wrap"
        buttonClassName="music-library__trigger"
        size="sm"
        strength="medium"
        type="button"
        aria-expanded={open}
        aria-controls="music-library-panel"
        aria-label="打开音乐层"
        onClick={() => (open ? closeLibrary() : setOpen(true))}
      >
        <span className="music-library__trigger-label">
          <span className="music-status-dot" aria-hidden="true" />
          <span>音乐层</span>
        </span>
      </GlassButton>

      {open && (
        <aside
          id="music-library-panel"
          className="music-library__panel"
          aria-label="音乐层"
          onMouseLeave={() => {
            if (!pinned) closeLibrary();
          }}
        >
          <header className="music-library__panel-header">
            <div>
              <h2>歌单 / 队列</h2>
              <p className="music-library__subhead">MUSIC AS MEMORY INPUT · 无需账号</p>
            </div>
            <div className="music-library__header-actions">
              <button
                id="playlist-pin-btn"
                className="music-library__pin"
                type="button"
                aria-pressed={pinned}
                onClick={() => setPinned((value) => !value)}
              >
                {pinned ? '已固定' : '固定'}
              </button>
              <GlassButton
                className="music-library__close-wrap"
                buttonClassName="music-library__close"
                size="icon"
                strength="subtle"
                type="button"
                aria-label="关闭音乐层"
                onClick={closeLibrary}
              >
                ×
              </GlassButton>
            </div>
          </header>

          <div className="music-library__source-tabs" role="tablist" aria-label="音乐来源">
            <button
              className={source === 'system' ? 'is-active' : ''}
              type="button"
              role="tab"
              aria-selected={source === 'system'}
              onClick={() => {
                setSource('system');
                setView('library');
              }}
            >
              系统音乐库 <span>{systemTracks.length}</span>
            </button>
            <button
              className={source === 'upload' ? 'is-active' : ''}
              type="button"
              role="tab"
              aria-selected={source === 'upload'}
              onClick={() => {
                setSource('upload');
                setView('library');
              }}
            >
              我的上传 <span>{uploads.length}</span>
            </button>
          </div>

          <div className="music-library__source-toolbar" role="status" aria-live="polite">
            <span>
              <span className="music-status-dot music-status-dot--connected" aria-hidden="true" />
              当前源 · {source === 'system' ? '系统音乐库' : '我的上传'}
            </span>
            <button type="button" onClick={uploadAnotherTrack}>上传音乐</button>
          </div>

          <div className="music-library__view-tabs" role="tablist" aria-label="音乐内容">
            <button className={view === 'library' ? 'is-active' : ''} type="button" onClick={() => setView('library')}>
              音乐列表 <span>{activeSourceTracks.length}</span>
            </button>
            <button className={view === 'queue' ? 'is-active' : ''} type="button" onClick={() => setView('queue')}>
              当前队列 <span>{queue.length}</span>
            </button>
          </div>

          {view === 'queue' ? (
            <div className="music-library__content">
              {track ? (
                <div className="music-library__now-playing">
                  <div className="music-library__now-playing-cover">
                    <Cover src={track.cover} label={track.name} source={track.source ?? 'system'} />
                  </div>
                  <div>
                    <p className="eyebrow">NOW PLAYING</p>
                    <strong>{track.name}</strong>
                    <span>{track.artist || track.fileName}</span>
                  </div>
                </div>
              ) : (
                <div className="music-library__empty">
                  <span className="music-library__empty-mark" aria-hidden="true">∿</span>
                  <strong>队列还是空的</strong>
                  <p>从系统音乐库选择歌曲，或上传一段 MP3 / WAV。</p>
                </div>
              )}
              {queue.length > 0 && (
                <div className="music-library__track-list" aria-label="当前播放队列">
                  {queue.map((queueTrack, index) => (
                    <TrackRow
                      key={`${queueTrack.id}-${String(index)}`}
                      track={queueTrack}
                      index={index}
                      active={queueIndex === index}
                      onPlay={() => playTracks(queue, index)}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="music-library__content">
              {source === 'system' ? (
                groupedSystemTracks.map(([category, tracks]) => (
                  <section className="music-library__bundled" aria-label={category} key={category}>
                    <div className="music-library__playlist-heading">
                      <strong>{category}</strong>
                      <span>{tracks.length} 首 · 点击加入队列</span>
                    </div>
                    <div className="music-library__track-list" aria-label={`${category}音乐列表`}>
                      {tracks.map((systemTrack, index) => (
                        <TrackRow
                          key={systemTrack.id}
                          track={systemTrack}
                          index={index}
                          active={track?.id === systemTrack.id}
                          onPlay={() => playTracks(tracks, index)}
                        />
                      ))}
                    </div>
                  </section>
                ))
              ) : uploads.length > 0 ? (
                <section className="music-library__bundled" aria-label="我的上传列表">
                  <div className="music-library__playlist-heading">
                    <strong>我的上传</strong>
                    <span>只保存在当前浏览器</span>
                  </div>
                  <div className="music-library__track-list" aria-label="我的上传列表">
                    {uploads.map((uploadTrack, index) => (
                      <TrackRow
                        key={uploadTrack.id}
                        track={uploadTrack}
                        index={index}
                        active={track?.id === uploadTrack.id}
                        onPlay={() => playTracks(uploads, index)}
                        onRemove={() => removeUploadedTrack(uploadTrack.id)}
                      />
                    ))}
                  </div>
                </section>
              ) : (
                <div className="music-library__empty">
                  <span className="music-library__empty-mark" aria-hidden="true">＋</span>
                  <strong>还没有上传音乐</strong>
                  <p>上传你有权使用的 MP3 或 WAV，音乐会成为记忆宇宙的输入。</p>
                  <button className="secondary-action" type="button" onClick={uploadAnotherTrack}>选择音频文件</button>
                </div>
              )}

            </div>
          )}
        </aside>
      )}
    </div>
  );
}
