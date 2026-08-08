import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { useMusicStore, type MusicTrack } from '../../stores/musicStore';
import { MusicLoginDialog } from './MusicLoginDialog';
import {
  getMusicAccountStatus,
  getMusicPlaylistTracks,
  getMusicPlaylists,
  providerLabel,
  providerShortLabel,
  type MusicAccount,
  type MusicPlaylist,
  type MusicProvider,
} from './musicService';

type LibraryView = 'queue' | 'playlists' | 'tracks';

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

function Cover({ src, label, provider }: { src: string | undefined; label: string; provider: MusicProvider | undefined }): ReactNode {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (src && src !== failedSrc) {
    return (
      <img
        className="music-library__cover"
        src={src}
        alt=""
        title={label}
        loading="lazy"
        onError={() => setFailedSrc(src)}
      />
    );
  }
  return (
    <span className={`music-library__cover music-library__cover--${provider ?? 'local'}`} title={label} aria-hidden="true">
      {provider ? providerShortLabel(provider) : '本地'}
    </span>
  );
}

export function MusicLibraryPopover(): ReactNode {
  const [open, setOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginProvider, setLoginProvider] = useState<MusicProvider>('netease');
  const [activeProvider, setActiveProvider] = useState<MusicProvider>('netease');
  const [view, setView] = useState<LibraryView>('playlists');
  const [accounts, setAccounts] = useState(EMPTY_ACCOUNTS);
  const [playlists, setPlaylists] = useState<Record<MusicProvider, MusicPlaylist[]>>({
    netease: [],
    qq: [],
  });
  const [selectedPlaylist, setSelectedPlaylist] = useState<MusicPlaylist | null>(null);
  const [playlistTracks, setPlaylistTracks] = useState<MusicTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    track,
    queue,
    queueIndex,
    setQueue,
    playQueueTrack,
    setConsoleOpen,
  } = useMusicStore();

  const connectedCount = useMemo(
    () => PROVIDERS.filter((provider) => accounts[provider]?.loggedIn).length,
    [accounts],
  );

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
    if (!open) return;
    void Promise.all(PROVIDERS.map((provider) => loadProvider(provider)));
  }, [loadProvider, open]);

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
    setError(null);
    void loadProvider(provider);
  };

  const handlePlaylistOpen = async (playlist: MusicPlaylist): Promise<void> => {
    setSelectedPlaylist(playlist);
    setView('tracks');
    setPlaylistTracks([]);
    setLoading(true);
    setError(null);
    try {
      const result = await getMusicPlaylistTracks(playlist.provider, playlist.id);
      setPlaylistTracks(result.tracks);
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

  const playTrack = (tracks: MusicTrack[], index: number): void => {
    setQueue(tracks);
    playQueueTrack(tracks, index);
    setOpen(false);
    setConsoleOpen(true);
  };

  const activeAccount = accounts[activeProvider];
  const activePlaylists = playlists[activeProvider];

  return (
    <div className="music-library" data-open={open || undefined}>
      <button
        className="music-library__trigger"
        type="button"
        aria-expanded={open}
        aria-controls="music-library-panel"
        onClick={() => setOpen((value) => !value)}
      >
        <span className={`music-status-dot ${connectedCount > 0 ? 'music-status-dot--connected' : ''}`} aria-hidden="true" />
        <span>音乐层</span>
        <small>{connectedCount > 0 ? `${String(connectedCount)} 个连接` : '未连接'}</small>
      </button>

      {open && (
        <aside id="music-library-panel" className="music-library__panel" aria-label="音乐层">
          <header className="music-library__panel-header">
            <div>
              <h2>歌单 / 队列</h2>
              <p className="music-library__subhead">QUEUE · 选择一条声音线索</p>
            </div>
            <button className="music-library__close" type="button" aria-label="关闭音乐层" onClick={() => setOpen(false)}>
              ×
            </button>
          </header>

          <div className="music-library__connection">
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
                <span>{activeAccount.vipLabel || '已连接'}</span>
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

          <div className="music-library__view-tabs" role="tablist" aria-label="音乐内容">
            <button className={view === 'queue' ? 'is-active' : ''} type="button" onClick={() => setView('queue')}>
              当前队列 <span>{queue.length || 0}</span>
            </button>
            <button className={view === 'playlists' || view === 'tracks' ? 'is-active' : ''} type="button" onClick={() => setView('playlists')}>
              我的歌单 <span>{activePlaylists.length || 0}</span>
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
                      <span className="music-library__track-number">{String(index + 1).padStart(2, '0')}</span>
                      <span>
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
                <button className="text-button" type="button" onClick={() => setView('playlists')}>
                  返回歌单
                </button>
                <div>
                  <p className="eyebrow">{selectedPlaylist?.trackCount ?? playlistTracks.length} TRACKS</p>
                  <strong>{selectedPlaylist?.name || '歌单内容'}</strong>
                </div>
              </div>
              {playlistTracks.length > 0 ? (
                <div className="music-library__track-list" aria-label={`${selectedPlaylist?.name ?? '歌单'}歌曲`}>
                  {playlistTracks.map((playlistTrack, index) => (
                    <button key={playlistTrack.id} type="button" onClick={() => playTrack(playlistTracks, index)}>
                      <span className="music-library__track-number">{String(index + 1).padStart(2, '0')}</span>
                      <span>
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

          {error && view !== 'tracks' && <p className="music-library__error" role="alert">{error}</p>}
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
