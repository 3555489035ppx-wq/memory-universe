import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { useMusicStore, type MusicTrack } from '../../stores/musicStore';
import { MusicLoginDialog } from './MusicLoginDialog';
import { GlassButton } from '../../components/ui/glass-button';
import { MusicArtwork } from './MusicArtwork';
import {
  getMusicAccountStatus,
  getMusicPlaylistTracks,
  getMusicPlaylists,
  getMusicStream,
  providerLabel,
  providerShortLabel,
  type MusicAccount,
  type MusicPlaylist,
  type MusicProvider,
} from './musicService';
import { shouldRefreshRemoteStream } from './audioPlayback';

type LibraryView = 'queue' | 'playlists' | 'tracks';
type PlaylistPaging = {
  nextOffset: number;
  total: number;
  hasMore: boolean;
};

const PROVIDERS: MusicProvider[] = ['netease', 'qq'];

const EMPTY_ACCOUNTS: Record<MusicProvider, MusicAccount | null> = {
  netease: null,
  qq: null,
};

function formatTrackDuration(value = 0): string {
  const seconds = value > 1000 ? Math.floor(value / 1000) : Math.floor(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return '--:--';
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

export function Cover({ src, label, provider }: { src: string | undefined; label: string; provider: MusicProvider | undefined }): ReactNode {
  return (
    <MusicArtwork
      src={src}
      label={label}
      className="music-library__cover"
      fallbackClassName={`music-library__cover music-library__cover--${provider ?? 'local'}`}
      fallbackText={provider ? providerShortLabel(provider) : '本地'}
    />
  );
}

function TrackLoadingSkeleton(): ReactNode {
  return (
    <div className="music-library__track-loading" role="status" aria-label="正在加载首屏歌曲">
      <span className="sr-only">正在加载首屏歌曲</span>
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="music-library__track-skeleton" aria-hidden="true">
          <span className="music-library__track-skeleton-index" />
          <span className="music-library__track-skeleton-copy">
            <i />
            <i />
          </span>
          <span className="music-library__track-skeleton-time" />
        </div>
      ))}
    </div>
  );
}

export function MusicLibraryPopover(): ReactNode {
  const [open, setOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginProvider, setLoginProvider] = useState<MusicProvider>('netease');
  const [activeProvider, setActiveProvider] = useState<MusicProvider>('netease');
  const [view, setView] = useState<LibraryView>('playlists');
  const [pinned, setPinned] = useState(false);
  const [accounts, setAccounts] = useState(EMPTY_ACCOUNTS);
  const [playlists, setPlaylists] = useState<Record<MusicProvider, MusicPlaylist[]>>({
    netease: [],
    qq: [],
  });
  const [selectedPlaylist, setSelectedPlaylist] = useState<MusicPlaylist | null>(null);
  const [playlistTracks, setPlaylistTracks] = useState<MusicTrack[]>([]);
  const [playlistPaging, setPlaylistPaging] = useState<PlaylistPaging>({
    nextOffset: 0,
    total: 0,
    hasMore: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wasLoginOpen = useRef(false);
  const streamPreloadTimerRef = useRef<number | null>(null);
  const {
    track,
    queue,
    queueIndex,
    setQueue,
    playQueueTrack,
    setTrackSource,
    setConsoleOpen,
  } = useMusicStore();

  const connectedCount = useMemo(
    () => PROVIDERS.filter((provider) => accounts[provider]?.loggedIn).length,
    [accounts],
  );

  const closeLibrary = useCallback((): void => {
    setPinned(false);
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  const loadProvider = useCallback(async (provider: MusicProvider): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const account = await getMusicAccountStatus(provider);
      setAccounts((current) => ({ ...current, [provider]: account }));
      if (!account.loggedIn) {
        setPlaylists((current) => ({ ...current, [provider]: [] }));
        return;
      }
      const nextPlaylists = await getMusicPlaylists(provider);
      setPlaylists((current) => ({ ...current, [provider]: nextPlaylists }));
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : '音乐服务暂时不可用。');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Music accounts are optional and network-backed. Do not probe either
    // provider while somebody is importing, browsing or backing up private
    // memories; sync only after the music surface is explicitly opened.
    if (!open) return;
    void Promise.all(PROVIDERS.map((provider) => loadProvider(provider)));
  }, [loadProvider, open]);

  useEffect(() => {
    const openLibrary = (): void => {
      setOpen(true);
      setLoginOpen(false);
      setView('playlists');
    };
    window.addEventListener('memuniverse:music-library-open', openLibrary);
    return () => window.removeEventListener('memuniverse:music-library-open', openLibrary);
  }, []);

  useEffect(() => {
    if (!open || loginOpen) return;
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') closeLibrary();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeLibrary, loginOpen, open]);

  useEffect(() => {
    if (wasLoginOpen.current && !loginOpen) triggerRef.current?.focus();
    wasLoginOpen.current = loginOpen;
  }, [loginOpen]);

  const openLogin = (provider: MusicProvider = activeProvider): void => {
    setLoginProvider(provider);
    setLoginOpen(true);
    setOpen(true);
  };

  const handleAuthenticated = useCallback(
    (account: MusicAccount): void => {
      setAccounts((current) => ({ ...current, [account.provider]: account }));
      setActiveProvider(account.provider);
      setView('playlists');
      void loadProvider(account.provider);
    },
    [loadProvider],
  );

  const handleProviderChange = (provider: MusicProvider): void => {
    setActiveProvider(provider);
    setView('playlists');
    setSelectedPlaylist(null);
    setPlaylistTracks([]);
    setPlaylistPaging({ nextOffset: 0, total: 0, hasMore: false });
    setError(null);
    void loadProvider(provider);
  };

  const handlePlaylistOpen = async (playlist: MusicPlaylist): Promise<void> => {
    setSelectedPlaylist(playlist);
    setView('tracks');
    setPlaylistTracks([]);
    setPlaylistPaging({ nextOffset: 0, total: playlist.trackCount, hasMore: playlist.trackCount > 0 });
    setLoading(true);
    setError(null);
    try {
      const result = await getMusicPlaylistTracks(playlist.provider, playlist.id, { limit: 48, offset: 0 });
      setPlaylistTracks(result.tracks);
      setPlaylistPaging({
        nextOffset: result.nextOffset,
        total: result.total || result.playlist?.trackCount || playlist.trackCount || result.tracks.length,
        hasMore: result.hasMore,
      });
      if (result.playlist) {
        setSelectedPlaylist({
          ...playlist,
          ...result.playlist,
          name: result.playlist.name || playlist.name,
          cover: result.playlist.cover || playlist.cover,
          trackCount: result.playlist.trackCount || playlist.trackCount,
        });
      }
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : '歌单内容读取失败。');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMoreTracks = async (): Promise<void> => {
    if (!selectedPlaylist || loading || !playlistPaging.hasMore) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getMusicPlaylistTracks(selectedPlaylist.provider, selectedPlaylist.id, {
        limit: 48,
        offset: playlistPaging.nextOffset,
      });
      setPlaylistTracks((current) => {
        const seen = new Set(current.map((item) => item.id));
        return [...current, ...result.tracks.filter((item) => !seen.has(item.id))];
      });
      setPlaylistPaging({
        nextOffset: result.nextOffset,
        total: result.total || playlistPaging.total,
        hasMore: result.hasMore,
      });
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : '更多歌曲暂时无法读取。');
    } finally {
      setLoading(false);
    }
  };

  const playTrack = (tracks: MusicTrack[], index: number): void => {
    const selectedTrack = tracks[index];
    setQueue(tracks);
    playQueueTrack(tracks, index);
    setOpen(false);
    setConsoleOpen(true);
    if (selectedTrack && shouldRefreshRemoteStream(selectedTrack)) {
      void getMusicStream(selectedTrack)
        .then((stream) => setTrackSource(selectedTrack.id, stream.proxiedUrl || stream.url, Date.now()))
        .catch(() => {
          // MusicExperience owns the visible retry/error state. This eager
          // request only shortens the gap between selection and first play.
        });
    }
  };

  const preloadTrack = (candidate: MusicTrack): void => {
    if (!shouldRefreshRemoteStream(candidate)) return;
    void getMusicStream(candidate).catch(() => {
      // Hover/focus preloading is opportunistic; clicking still retries.
    });
  };

  const scheduleTrackPreload = (candidate: MusicTrack): void => {
    if (streamPreloadTimerRef.current !== null) window.clearTimeout(streamPreloadTimerRef.current);
    streamPreloadTimerRef.current = window.setTimeout(() => {
      streamPreloadTimerRef.current = null;
      preloadTrack(candidate);
    }, 120);
  };

  const cancelTrackPreload = (): void => {
    if (streamPreloadTimerRef.current === null) return;
    window.clearTimeout(streamPreloadTimerRef.current);
    streamPreloadTimerRef.current = null;
  };

  useEffect(() => cancelTrackPreload, []);

  const activeAccount = accounts[activeProvider];
  const activePlaylists = playlists[activeProvider];

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
        aria-label={activeAccount?.loggedIn ? `音乐账号：${activeAccount.nickname || '已连接账号'}` : '打开音乐层'}
        onClick={() => {
          if (open) closeLibrary();
          else setOpen(true);
        }}
      >
        {activeAccount?.loggedIn ? (
          <span className="music-library__trigger-account">
            {activeAccount.avatar ? (
              <img src={activeAccount.avatar} alt="" />
            ) : (
              <span className="music-library__trigger-avatar-fallback" aria-hidden="true" />
            )}
            <span>
              <strong>{activeAccount.nickname || '已连接账号'}</strong>
            </span>
          </span>
        ) : (
          <span className="music-library__trigger-label">
            <span className="music-status-dot" aria-hidden="true" />
            <span>音乐层</span>
          </span>
        )}
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
              <p className="music-library__subhead">QUEUE · 鼠标移开自动隐藏</p>
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

          <div className="music-library__connection" role="status" aria-live="polite">
            <span className={`music-status-dot ${connectedCount > 0 ? 'music-status-dot--connected' : ''}`} aria-hidden="true" />
            <span>{connectedCount > 0 ? '本机音乐服务已连接' : '本地音乐服务未登录'}</span>
            <button type="button" onClick={() => openLogin(activeProvider)}>
              {connectedCount > 0 ? '管理' : '登录平台'}
            </button>
          </div>

          <div className="music-library__provider-tabs" role="tablist" aria-label="音乐平台">
            {PROVIDERS.map((provider) => {
              const account = accounts[provider];
              return (
                <button
                  key={provider}
                  className={activeProvider === provider ? 'is-active' : ''}
                  type="button"
                  role="tab"
                  aria-selected={activeProvider === provider}
                  onClick={() => handleProviderChange(provider)}
                >
                  <span className="music-library__provider-name">{providerLabel(provider)}</span>
                  <i className={`music-status-dot ${account?.loggedIn ? 'music-status-dot--connected' : ''}`} aria-label={account?.loggedIn ? '已登录' : '未登录'} />
                </button>
              );
            })}
          </div>

          {activeAccount?.loggedIn ? (
            <div className="music-library__account">
              <Cover src={activeAccount.avatar} label={activeAccount.nickname || '账号'} provider={activeProvider} />
              <div>
                <strong>{activeAccount.nickname || '已登录账号'}</strong>
                <span>{providerLabel(activeProvider)} · {activeAccount.vipLabel || '已连接'}</span>
              </div>
              <button type="button" onClick={() => openLogin(activeProvider)}>
                账号
              </button>
            </div>
          ) : (
            <button className="music-library__login-prompt" type="button" onClick={() => openLogin(activeProvider)}>
              <span>
                <strong>登录 {providerLabel(activeProvider)}</strong>
                <small>读取你的歌单与播放地址</small>
              </span>
            </button>
          )}

          <div className="music-library__source-toolbar">
            <span>
              <span className="music-status-dot" aria-hidden="true" />
              当前源 · {providerLabel(activeProvider)}
            </span>
            <button type="button" onClick={() => void loadProvider(activeProvider)} disabled={loading}>
              {loading ? '同步中' : '刷新'}
            </button>
          </div>

          <div className="music-library__view-tabs" role="tablist" aria-label="音乐内容">
            <button className={view === 'playlists' || view === 'tracks' ? 'is-active' : ''} type="button" onClick={() => setView('playlists')}>
              我的歌单 <span>{activePlaylists.length || 0}</span>
            </button>
            <button className={view === 'queue' ? 'is-active' : ''} type="button" onClick={() => setView('queue')}>
              当前队列 <span>{queue.length || 0}</span>
            </button>
          </div>

          {view === 'queue' ? (
            <div className="music-library__content">
              {track ? (
                <div className="music-library__now-playing">
                  <div className="music-library__now-playing-cover">
                    <Cover src={track.cover} label={track.name} provider={track.provider} />
                  </div>
                  <div>
                    <p className="eyebrow">NOW PLAYING</p>
                    <strong>{track.name}</strong>
                    <span>{track.artist || (track.source === 'remote' ? providerLabel(track.provider ?? 'netease') : track.fileName)}</span>
                  </div>
                </div>
              ) : (
                <div className="music-library__empty">
                  <span className="music-library__empty-mark" aria-hidden="true">∿</span>
                  <strong>队列还是空的</strong>
                  <p>从歌单里选择一首，或从电脑导入一段本地音乐。</p>
                </div>
              )}
              {queue.length > 0 && (
                <div className="music-library__track-list" aria-label="当前播放队列">
                  {queue.map((queueTrack, index) => (
                    <button
                      key={`${queueTrack.id}-${String(index)}`}
                      className={queueIndex === index ? 'is-active' : ''}
                      type="button"
                      onClick={() => playTrack(queue, index)}
                    >
                      <Cover src={queueTrack.cover} label={queueTrack.name} provider={queueTrack.provider} />
                      <span className="music-library__track-number">{String(index + 1).padStart(2, '0')}</span>
                      <span className="music-library__track-copy">
                        <strong>{queueTrack.name}</strong>
                        <small>{queueTrack.artist || queueTrack.fileName}</small>
                      </span>
                      <time>{formatTrackDuration(queueTrack.duration)}</time>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : view === 'playlists' ? (
            <div className="music-library__content" aria-busy={loading}>
              {!activeAccount?.loggedIn ? (
                <div className="music-library__empty music-library__empty--login">
                  <strong>先连接一个平台</strong>
                  <p>登录后，这里会显示你的真实歌单，不使用演示数据。</p>
                  <button className="secondary-action" type="button" onClick={() => openLogin(activeProvider)}>
                    登录 {providerLabel(activeProvider)}
                  </button>
                </div>
              ) : activePlaylists.length > 0 ? (
                <>
                  <div className="music-library__playlist-heading">
                    <strong>{providerLabel(activeProvider)}歌单</strong>
                    <span>{activePlaylists.length} 个歌单</span>
                  </div>
                  <div className="music-library__playlist-list">
                    {activePlaylists.map((playlist) => (
                      <button key={playlist.id} className="music-library__playlist-item" type="button" onClick={() => void handlePlaylistOpen(playlist)}>
                        <Cover src={playlist.cover} label={playlist.name} provider={activeProvider} />
                        <span>
                          <strong>
                            {playlist.name}
                            <em className={`music-provider-badge music-provider-badge--${playlist.provider}`}>
                              {providerShortLabel(playlist.provider)}
                            </em>
                          </strong>
                          <small>{playlist.trackCount} 首 · {playlist.creator || '个人歌单'}</small>
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="music-library__empty">
                  <strong>还没有读取到歌单</strong>
                  <p>点击刷新，或确认当前账号已经登录。</p>
                  <button className="secondary-action" type="button" onClick={() => void loadProvider(activeProvider)} disabled={loading}>
                    刷新歌单
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="music-library__content" aria-busy={loading}>
              <div className="music-library__tracks-header">
                <button className="music-library__back-to-playlists text-button" type="button" aria-label="返回我的歌单" onClick={() => setView('playlists')}>
                  返回歌单
                </button>
                <div>
                  <p className="eyebrow">{selectedPlaylist?.trackCount ?? playlistTracks.length} TRACKS</p>
                  <strong>{selectedPlaylist?.name || '歌单内容'}</strong>
                </div>
              </div>
              {loading && playlistTracks.length === 0 && <TrackLoadingSkeleton />}
              {playlistTracks.length > 0 ? (
                <div className="music-library__track-list" aria-label={`${selectedPlaylist?.name ?? '歌单'}歌曲`}>
                  {playlistTracks.map((playlistTrack, index) => (
                    <button
                      key={playlistTrack.id}
                      type="button"
                      onPointerEnter={() => scheduleTrackPreload(playlistTrack)}
                      onPointerLeave={cancelTrackPreload}
                      onFocus={() => preloadTrack(playlistTrack)}
                      onClick={() => playTrack(playlistTracks, index)}
                    >
                      <Cover src={playlistTrack.cover} label={playlistTrack.name} provider={playlistTrack.provider} />
                      <span className="music-library__track-number">{String(index + 1).padStart(2, '0')}</span>
                      <span className="music-library__track-copy">
                        <strong>{playlistTrack.name}</strong>
                        <small>{playlistTrack.artist || playlistTrack.album || '未知艺术家'}</small>
                      </span>
                      <time>{formatTrackDuration(playlistTrack.duration)}</time>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="music-library__empty">
                  <strong>{loading ? '正在读取歌曲…' : '这个歌单没有可播放歌曲'}</strong>
                  <p>{error || '播放地址会在你选择歌曲后按需请求。'}</p>
                </div>
              )}
            </div>
          )}

          {view === 'tracks' && playlistTracks.length > 0 && playlistPaging.hasMore && (
            <button className="music-library__load-more" type="button" onClick={() => void handleLoadMoreTracks()} disabled={loading}>
              {loading ? '正在读取下一批' : '加载更多歌曲'}
            </button>
          )}
          {error && <p className="music-library__error" role="alert">{error}</p>}
        </aside>
      )}

      {loginOpen && (
        <MusicLoginDialog
          initialProvider={loginProvider}
          onAuthenticated={handleAuthenticated}
          onClose={() => setLoginOpen(false)}
        />
      )}
    </div>
  );
}
