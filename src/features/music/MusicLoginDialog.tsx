import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import {
  checkNeteaseQr,
  getMusicAccountStatus,
  getMusicApiBaseUrl,
  hasDesktopMusicLogin,
  logoutMusicProvider,
  openDesktopMusicLogin,
  providerLabel,
  requestNeteaseQr,
  saveMusicApiBaseUrl,
  submitMusicCookie,
  type MusicAccount,
  type MusicProvider,
  type NeteaseQrCode,
} from './musicService';

interface MusicLoginDialogProps {
  initialProvider: MusicProvider;
  onAuthenticated: (account: MusicAccount) => void;
  onClose: () => void;
}

type LoginMode = 'loading' | 'connected' | 'qr' | 'desktop' | 'cookie' | 'offline';

function loginModeLabel(mode: LoginMode): string {
  if (mode === 'connected') return '已连接';
  if (mode === 'qr') return '等待扫码';
  if (mode === 'desktop') return '官方窗口';
  if (mode === 'cookie') return '手动导入';
  if (mode === 'offline') return '连接失败';
  return '连接中';
}

export function MusicLoginDialog({
  initialProvider,
  onAuthenticated,
  onClose,
}: MusicLoginDialogProps): ReactNode {
  const [provider, setProvider] = useState<MusicProvider>(initialProvider);
  const [account, setAccount] = useState<MusicAccount | null>(null);
  const [mode, setMode] = useState<LoginMode>('loading');
  const [qrCode, setQrCode] = useState<NeteaseQrCode | null>(null);
  const [qrStatus, setQrStatus] = useState('准备二维码');
  const [cookie, setCookie] = useState('');
  const [apiBase, setApiBase] = useState(getMusicApiBaseUrl());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pollRef = useRef<number | null>(null);

  const stopPolling = useCallback((): void => {
    if (pollRef.current !== null) window.clearInterval(pollRef.current);
    pollRef.current = null;
  }, []);

  const finishAuthentication = useCallback(
    (nextAccount: MusicAccount): void => {
      setAccount(nextAccount);
      setMode('connected');
      setCookie('');
      setError(null);
      onAuthenticated(nextAccount);
    },
    [onAuthenticated],
  );

  const pollNeteaseQr = useCallback(
    (key: string): void => {
      stopPolling();
      pollRef.current = window.setInterval(() => {
        void checkNeteaseQr(key)
          .then(async (status) => {
            setQrStatus(status.message);
            if (status.code === 803) {
              stopPolling();
              const nextAccount = await getMusicAccountStatus('netease');
              finishAuthentication(nextAccount);
            } else if (status.code === 800) {
              stopPolling();
              setMode('offline');
              setError('二维码已过期，请重新生成。');
            }
          })
          .catch((reason: unknown) => {
            stopPolling();
            setMode('offline');
            setError(reason instanceof Error ? reason.message : '二维码状态检查失败。');
          });
      }, 2200);
    },
    [finishAuthentication, stopPolling],
  );

  const startNeteaseQr = useCallback(async (): Promise<void> => {
    stopPolling();
    setBusy(true);
    setError(null);
    setMode('loading');
    try {
      const nextQrCode = await requestNeteaseQr();
      setQrCode(nextQrCode);
      setQrStatus('等待扫码');
      setMode('qr');
      pollNeteaseQr(nextQrCode.key);
    } catch (reason: unknown) {
      setMode('offline');
      setError(reason instanceof Error ? reason.message : '二维码创建失败。');
    } finally {
      setBusy(false);
    }
  }, [pollNeteaseQr, stopPolling]);

  const refresh = useCallback(
    async (forceLogin = false): Promise<void> => {
      stopPolling();
      setBusy(true);
      setError(null);
      setMode('loading');
      try {
        const currentAccount = await getMusicAccountStatus(provider);
        setAccount(currentAccount);
        if (currentAccount.loggedIn && !forceLogin) {
          finishAuthentication(currentAccount);
          return;
        }
        if (provider === 'netease') {
          if (hasDesktopMusicLogin(provider)) {
            setMode('desktop');
          } else {
            await startNeteaseQr();
          }
        } else {
          setMode(hasDesktopMusicLogin(provider) ? 'desktop' : 'cookie');
        }
      } catch (reason: unknown) {
        setMode('offline');
        setError(reason instanceof Error ? reason.message : '音乐服务暂时不可用。');
      } finally {
        setBusy(false);
      }
    },
    [finishAuthentication, provider, startNeteaseQr, stopPolling],
  );

  useEffect(() => {
    void refresh();
    return stopPolling;
  }, [provider, refresh, stopPolling]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const handleProviderChange = (nextProvider: MusicProvider): void => {
    if (nextProvider === provider) return;
    stopPolling();
    setProvider(nextProvider);
    setAccount(null);
    setQrCode(null);
    setCookie('');
    setError(null);
    setMode('loading');
  };

  const handleDesktopLogin = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const result = await openDesktopMusicLogin(provider);
      if (result.cancelled) return;
      if (!result.cookie) throw new Error(result.error || '官方登录窗口没有返回登录状态。');
      const nextAccount = await submitMusicCookie(provider, result.cookie);
      finishAuthentication(nextAccount);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : '官方登录失败。');
    } finally {
      setBusy(false);
    }
  };

  const handleCookieLogin = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const nextAccount = await submitMusicCookie(provider, cookie);
      finishAuthentication(nextAccount);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Cookie 导入失败。');
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await logoutMusicProvider(provider);
      setAccount(null);
      setQrCode(null);
      await refresh(true);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : '退出登录失败。');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveApiBase = (): void => {
    setApiBase(saveMusicApiBaseUrl(apiBase));
    void refresh();
  };

  const providerName = providerLabel(provider);
  const desktopAvailable = hasDesktopMusicLogin(provider);

  return (
    <div
      className="music-login-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section className="music-login-dialog" role="dialog" aria-modal="true" aria-labelledby="music-login-title">
        <header className="music-login-dialog__header">
          <div>
            <p className="eyebrow">ACCOUNT BRIDGE / {loginModeLabel(mode).toUpperCase()}</p>
            <h2 id="music-login-title">连接你的音乐世界</h2>
            <p>账号只交给本机音乐服务处理，记忆宇宙不保存密码或原始 Cookie。</p>
          </div>
          <button className="music-login-dialog__close" type="button" aria-label="关闭登录窗口" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="music-login__provider-tabs" role="tablist" aria-label="选择音乐平台">
          {(['netease', 'qq'] as MusicProvider[]).map((nextProvider) => (
            <button
              key={nextProvider}
              className={provider === nextProvider ? 'is-active' : ''}
              type="button"
              role="tab"
              aria-selected={provider === nextProvider}
              onClick={() => handleProviderChange(nextProvider)}
            >
              <span className={`music-provider-mark music-provider-mark--${nextProvider}`}>
                {nextProvider === 'qq' ? 'Q' : 'N'}
              </span>
              {providerLabel(nextProvider)}
            </button>
          ))}
        </div>

        <div className="music-login__body">
          <aside className="music-login__intro">
            <p className="music-login__index">01 / SOURCE</p>
            <strong>{providerName}</strong>
            <p>
              把你的歌单作为记忆的另一条索引。登录只为读取歌单、搜索和播放地址，原始音乐文件不会进入项目数据。
            </p>
            <div className="music-login__privacy-line">
              <span className="music-status-dot music-status-dot--safe" aria-hidden="true" />
              <span>本地连接 · 可随时退出</span>
            </div>
          </aside>

          <div className="music-login__form">
            {account?.loggedIn ? (
              <div className="music-login__connected" role="status">
                <div className="music-login__account-row">
                  {account.avatar ? (
                    <img src={account.avatar} alt="" />
                  ) : (
                    <span className="music-login__avatar-fallback" aria-hidden="true">
                      {provider === 'qq' ? 'Q' : 'N'}
                    </span>
                  )}
                  <div>
                    <strong>{account.nickname || '已登录账号'}</strong>
                    <span>
                      {account.vipLabel || (account.isSvip ? 'SVIP' : account.isVip ? 'VIP' : '已连接')}
                    </span>
                  </div>
                </div>
                <p>歌单和播放地址会通过本机服务读取。你可以继续使用当前账号，或切换账号。</p>
                <div className="music-login__actions">
                  <button className="primary-action" type="button" onClick={onClose}>
                    继续使用
                  </button>
                  <button className="secondary-action" type="button" onClick={() => void handleLogout()} disabled={busy}>
                    切换账号
                  </button>
                </div>
              </div>
            ) : mode === 'qr' && qrCode && provider === 'netease' ? (
              <div className="music-login__qr-panel">
                <div className="music-login__qr-frame">
                  <img src={qrCode.image} alt="网易云音乐登录二维码" />
                </div>
                <strong>用网易云音乐 App 扫码</strong>
                <span>{qrStatus}</span>
                <button className="text-button" type="button" onClick={() => void startNeteaseQr()} disabled={busy}>
                  刷新二维码
                </button>
              </div>
            ) : mode === 'desktop' ? (
              <div className="music-login__method-panel">
                <div className="music-login__method-icon" aria-hidden="true">
                  ↗
                </div>
                <strong>打开官方登录窗口</strong>
                <p>
                  {desktopAvailable
                    ? '在桌面环境中完成登录后，音乐服务会自动接管歌单和播放状态。'
                    : '当前是浏览器预览环境，没有权限读取音乐网站的登录会话。请切换到 Mineradio 桌面环境，或使用 Cookie 导入。'}
                </p>
                <button
                  className="primary-action"
                  type="button"
                  onClick={() => void handleDesktopLogin()}
                  disabled={busy || !desktopAvailable}
                >
                  {busy ? '等待登录…' : '打开官方登录'}
                </button>
                {provider === 'qq' && (
                  <button className="text-button" type="button" onClick={() => setMode('cookie')}>
                    改用 Cookie 导入
                  </button>
                )}
              </div>
            ) : mode === 'cookie' && provider === 'qq' ? (
              <div className="music-login__cookie-panel">
                <strong>导入 QQ 音乐登录状态</strong>
                <p>在 QQ 音乐网页端登录后复制 Cookie。它只会直传本机音乐服务，成功后输入框会立即清空。</p>
                <textarea
                  value={cookie}
                  onChange={(event) => setCookie(event.target.value)}
                  placeholder="粘贴 QQ 音乐 Cookie"
                  spellCheck={false}
                  autoComplete="off"
                  aria-label="QQ 音乐 Cookie"
                />
                <button className="primary-action" type="button" onClick={() => void handleCookieLogin()} disabled={busy || !cookie.trim()}>
                  {busy ? '正在连接…' : '安全导入并连接'}
                </button>
                {desktopAvailable && (
                  <button className="text-button" type="button" onClick={() => setMode('desktop')}>
                    返回官方登录窗口
                  </button>
                )}
              </div>
            ) : mode === 'offline' ? (
              <div className="music-login__method-panel music-login__method-panel--error">
                <div className="music-login__method-icon" aria-hidden="true">
                  !
                </div>
                <strong>本机音乐服务未连接</strong>
                <p>{error || '请确认 Mineradio 正在运行，或修改下方的服务地址。'}</p>
                <button className="primary-action" type="button" onClick={() => void refresh()} disabled={busy}>
                  {busy ? '正在重试…' : '重新连接'}
                </button>
              </div>
            ) : (
              <div className="music-login__loading" role="status">
                <span className="music-login__loading-line" />
                <span>正在连接 {providerName}…</span>
              </div>
            )}

            {error && mode !== 'offline' && !account?.loggedIn && (
              <p className="music-login__error" role="alert">
                {error}
              </p>
            )}
          </div>
        </div>

        <details className="music-login__settings">
          <summary>连接设置</summary>
          <div>
            <label htmlFor="music-api-base">本机音乐服务地址</label>
            <div className="music-login__api-row">
              <input
                id="music-api-base"
                value={apiBase}
                onChange={(event) => setApiBase(event.target.value)}
                inputMode="url"
                spellCheck={false}
              />
              <button className="secondary-action" type="button" onClick={handleSaveApiBase} disabled={busy}>
                保存
              </button>
            </div>
            <p>默认地址为 http://127.0.0.1:3000；Mineradio 运行时无需额外配置。</p>
          </div>
        </details>
      </section>
    </div>
  );
}
