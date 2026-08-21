import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import {
  checkNeteaseQr,
  clearDesktopMusicLogin,
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
import { HIGH_SCHOOL_DEMO_TRACK } from './demoMusic';
import { useMusicStore } from '../../stores/musicStore';

interface MusicLoginDialogProps {
  initialProvider: MusicProvider;
  onAuthenticated: (account: MusicAccount) => void;
  onClose: () => void;
}

type LoginMode = 'loading' | 'connected' | 'qr' | 'desktop' | 'cookie' | 'offline' | 'demo';

type DemoMusicSource = 'kugou' | 'soda';
type MusicSourceOption = MusicProvider | DemoMusicSource;
type DemoFlowStatus = 'ready' | 'connecting' | 'reading' | 'success';

const DEMO_QR_PATTERN = [
  '1111111001011',
  '1000001010111',
  '1011101011001',
  '1011101001110',
  '1011101110101',
  '1000001011100',
  '1111111010101',
  '0010110011010',
  '1101011110011',
  '0110100011101',
  '1011011100110',
  '1110001011011',
  '1001110110101',
] as const;

const SOURCE_OPTIONS: readonly {
  id: MusicSourceOption;
  label: string;
  description: string;
  demoOnly?: boolean;
}[] = [
  { id: 'kugou', label: '酷狗音乐', description: '演示入口：扫码接入正在准备中', demoOnly: true },
  { id: 'soda', label: '汽水音乐', description: '演示入口：本地预置歌曲可直接体验', demoOnly: true },
  { id: 'netease', label: '网易云音乐', description: '连接网易云音乐歌单与播放地址' },
  { id: 'qq', label: 'QQ 音乐', description: '连接 QQ 音乐歌单与播放授权' },
];

function loginModeLabel(mode: LoginMode): string {
  if (mode === 'connected') return '已连接';
  if (mode === 'qr') return '扫码登录';
  if (mode === 'desktop') return '官方窗口';
  if (mode === 'cookie') return 'Cookie 导入';
  if (mode === 'offline') return '需要重试';
  if (mode === 'demo') return '演示接入';
  return '准备中';
}

function accountLabel(account: MusicAccount | null, mode: LoginMode, provider: MusicProvider): string {
  if (account?.loggedIn) return account.vipLabel || '已连接';
  if (mode === 'loading') return '正在检查连接';
  if (mode === 'qr' && provider === 'netease') return '等待扫码';
  if (mode === 'desktop') return '官方窗口';
  if (mode === 'cookie') return '等待导入';
  if (mode === 'offline') return '未连接';
  return '未连接';
}

function ProviderMark({ provider }: { provider: MusicSourceOption }): ReactNode {
  return (
    <span
      className={'music-provider-mark music-provider-mark--' + provider}
      aria-hidden="true"
    >
      <span />
    </span>
  );
}

function DemoQrVisual({ provider }: { provider: DemoMusicSource }): ReactNode {
  return (
    <div
      className="music-login__demo-qr"
      role="img"
      aria-label={`${provider === 'kugou' ? '酷狗音乐' : '汽水音乐'}本地演示二维码，不连接第三方账号`}
    >
      {DEMO_QR_PATTERN.flatMap((row, rowIndex) =>
        row.split('').map((cell, columnIndex) => (
          <span
            key={String(rowIndex) + '-' + String(columnIndex)}
            className={cell === '1' ? 'is-filled' : undefined}
          />
        )),
      )}
    </div>
  );
}

export function MusicLoginDialog({
  initialProvider,
  onAuthenticated,
  onClose,
}: MusicLoginDialogProps): ReactNode {
  const [provider, setProvider] = useState<MusicProvider>(initialProvider);
  const [demoSource, setDemoSource] = useState<DemoMusicSource | null>(null);
  const [accounts, setAccounts] = useState<Record<MusicProvider, MusicAccount | null>>({
    netease: null,
    qq: null,
  });
  const [mode, setMode] = useState<LoginMode>('loading');
  const [qrCode, setQrCode] = useState<NeteaseQrCode | null>(null);
  const [qrStatus, setQrStatus] = useState('准备二维码');
  const [cookie, setCookie] = useState('');
  const [apiBase, setApiBase] = useState(getMusicApiBaseUrl());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [demoFlowStatus, setDemoFlowStatus] = useState<DemoFlowStatus>('ready');
  const pollRef = useRef<number | null>(null);
  const pollingKeyRef = useRef<string | null>(null);
  const demoTimerRef = useRef<number | null>(null);
  const setTrack = useMusicStore((state) => state.setTrack);

  const account = accounts[provider];
  const sourceId: MusicSourceOption = demoSource ?? provider;

  const stopPolling = useCallback((): void => {
    if (pollRef.current !== null) window.clearTimeout(pollRef.current);
    pollRef.current = null;
    pollingKeyRef.current = null;
  }, []);

  const stopDemoFlow = useCallback((): void => {
    if (demoTimerRef.current !== null) window.clearTimeout(demoTimerRef.current);
    demoTimerRef.current = null;
  }, []);

  const finishAuthentication = useCallback(
    (nextAccount: MusicAccount): void => {
      setAccounts((current) => ({ ...current, [nextAccount.provider]: nextAccount }));
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
      pollingKeyRef.current = key;
      const poll = async (): Promise<void> => {
        if (pollingKeyRef.current !== key) return;
        try {
          const status = await checkNeteaseQr(key);
          if (pollingKeyRef.current !== key) return;
          if (status.code === 801) {
            setQrStatus('等待网易云音乐 App 扫码');
          } else if (status.code === 802) {
            setQrStatus('已扫码，请在手机上确认');
          } else if (status.code === 803) {
            stopPolling();
            setQrStatus('登录成功，正在同步账号');
            const nextAccount = await getMusicAccountStatus('netease');
            if (!nextAccount.loggedIn) {
              setMode('offline');
              setError('扫码已确认，但账号还没有同步完成，请稍后重试。');
              return;
            }
            finishAuthentication(nextAccount);
            return;
          } else if (status.code === 800) {
            stopPolling();
            setMode('offline');
            setError('二维码已过期，请重新生成。');
            return;
          } else {
            setQrStatus(status.message || '等待扫码');
          }
        } catch {
          // The connector request itself retries transient failures. Keep the
          // QR session alive for one more poll when the upstream briefly
          // drops, instead of throwing the user back to the error screen.
          if (pollingKeyRef.current !== key) return;
          setQrStatus('连接暂时波动，正在自动重试…');
        }
        if (pollingKeyRef.current === key) {
          pollRef.current = window.setTimeout(() => void poll(), 2200);
        }
      };
      void poll();
    },
    [finishAuthentication, stopPolling],
  );

  const startNeteaseQr = useCallback(async (): Promise<void> => {
    stopPolling();
    setBusy(true);
    setError(null);
    setQrCode(null);
    setMode('loading');
    try {
      const nextQrCode = await requestNeteaseQr();
      setQrCode(nextQrCode);
      setQrStatus('等待网易云音乐 App 扫码');
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
        setAccounts((current) => ({ ...current, [provider]: currentAccount }));
        if (currentAccount.loggedIn && !forceLogin) {
          finishAuthentication(currentAccount);
          return;
        }

        if (hasDesktopMusicLogin(provider)) {
          setMode('desktop');
        } else if (provider === 'netease') {
          // Browser fallback uses a real QR generated by the local music
          // service. It is not a fake preview and remains the only way to
          // sync a browser session without Electron's official bridge.
          await startNeteaseQr();
        } else {
          setMode('cookie');
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
    return () => {
      stopPolling();
      stopDemoFlow();
    };
  }, [provider, refresh, stopDemoFlow, stopPolling]);

  useEffect(() => () => stopDemoFlow(), [stopDemoFlow]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const handleSourceChange = (nextSource: MusicSourceOption): void => {
    if (nextSource === sourceId) return;
    stopPolling();
    stopDemoFlow();
    setQrCode(null);
    setCookie('');
    setError(null);
    if (nextSource === 'kugou' || nextSource === 'soda') {
      setDemoSource(nextSource);
      setDemoFlowStatus('ready');
      setMode('demo');
      return;
    }
    setDemoSource(null);
    setProvider(nextSource);
    setMode('loading');
  };

  const startDemoFlow = (): void => {
    if (demoFlowStatus !== 'ready' || !demoSource) return;
    stopDemoFlow();
    setError(null);
    setDemoFlowStatus('connecting');
    demoTimerRef.current = window.setTimeout(() => {
      setDemoFlowStatus('reading');
      demoTimerRef.current = window.setTimeout(() => {
        setDemoFlowStatus('success');
        demoTimerRef.current = null;
      }, 720);
    }, 720);
  };

  const confirmDemoTrack = (): void => {
    if (demoFlowStatus !== 'success') return;
    setTrack(HIGH_SCHOOL_DEMO_TRACK);
    onClose();
  };

  const handleDesktopLogin = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const result = await openDesktopMusicLogin(provider);
      if (result.cancelled) {
        setError('官方登录窗口已关闭，账号尚未连接。');
        return;
      }
      if (!result.ok || !result.cookie) {
        throw new Error(result.error || '官方登录窗口没有返回登录状态。');
      }
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
      const tasks: Array<Promise<unknown>> = [logoutMusicProvider(provider)];
      if (hasDesktopMusicLogin(provider)) tasks.push(clearDesktopMusicLogin(provider));
      const results = await Promise.allSettled(tasks);
      const rejected = results.find((result) => result.status === 'rejected');
      if (rejected?.status === 'rejected') throw rejected.reason;
      setAccounts((current) => ({ ...current, [provider]: null }));
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

  const providerName = demoSource === 'kugou'
    ? '酷狗音乐'
    : demoSource === 'soda'
      ? '汽水音乐'
      : providerLabel(provider);
  const desktopAvailable = hasDesktopMusicLogin(provider);
  const canUseBrowserQr = provider === 'netease' && Boolean(qrCode);
  const currentStatus = demoSource ? '演示接入' : accountLabel(account, mode, provider);
  const demoStatusLabel = demoFlowStatus === 'connecting'
    ? '正在建立本地演示连接…'
    : demoFlowStatus === 'reading'
      ? '已扫码，正在读取预置歌曲…'
      : demoFlowStatus === 'success'
        ? '演示读取完成'
        : '等待开始演示扫码';

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
            <p className="eyebrow">MUSIC SOURCE / {loginModeLabel(mode).toUpperCase()}</p>
            <h2 id="music-login-title">连接音乐源</h2>
            <p>选择一个平台。扫码和账号输入发生在官方或本机音乐服务中，记忆宇宙不保存密码或原始 Cookie。</p>
          </div>
          <button className="music-login-dialog__close" type="button" aria-label="关闭音乐接入" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="music-login__source-layout">
          <aside className="music-login__source-panel" aria-label="音乐源列表">
            <div className="music-login__source-heading">
              <div>
                <span className="music-login__source-kicker">SOURCE ROUTER</span>
                <strong>选择音乐平台</strong>
              </div>
              <span className="music-login__source-count">04</span>
            </div>
            <div className="music-login__source-list" role="tablist" aria-label="选择音乐平台">
              {SOURCE_OPTIONS.map((option) => {
                const nextAccount = option.demoOnly ? null : accounts[option.id as MusicProvider];
                const isActive = sourceId === option.id;
                return (
                  <button
                    key={option.id}
                    className={'music-login__source-row ' + (isActive ? 'is-active' : '')}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => handleSourceChange(option.id)}
                  >
                    <ProviderMark provider={option.id} />
                    <span className="music-login__source-copy">
                      <strong>{option.label}</strong>
                      <small>{nextAccount?.loggedIn ? nextAccount.nickname || '已连接账号' : option.description}</small>
                    </span>
                    <span
                      className={'music-login__source-status ' + (nextAccount?.loggedIn ? 'is-connected' : '')}
                      aria-label={nextAccount?.loggedIn ? '已连接' : option.demoOnly ? '演示入口' : '未连接'}
                    />
                  </button>
                );
              })}
            </div>
            <div className="music-login__source-footnote">
              <span className="music-status-dot music-status-dot--safe" aria-hidden="true" />
              <span>账号会话由本机音乐服务处理</span>
            </div>
          </aside>

          <div className="music-login__route-connector" aria-hidden="true">
            <span className="music-login__route-line" />
            <span className="music-login__route-node" />
            <span className="music-login__route-label">MR</span>
          </div>

          <div className="music-login__form">
            <div className="music-login__form-header">
              <div>
                <span className="music-login__source-kicker">CURRENT SOURCE</span>
                <strong>{providerName}</strong>
              </div>
              <span className={'music-login__mode-chip music-login__mode-chip--' + mode}>
                {currentStatus}
              </span>
            </div>

            {demoSource ? (
              <div className="music-login__method-panel music-login__demo-panel" role="status" aria-live="polite">
                <div className="music-login__method-label">DEMO SOURCE / LOCAL FALLBACK</div>
                <div className="music-login__demo-flow">
                  <div className="music-login__demo-qr-shell">
                    <DemoQrVisual provider={demoSource} />
                    <small>演示二维码 · 不连接第三方账号</small>
                  </div>
                  <div className="music-login__demo-copy">
                    <strong>{providerName}演示接入</strong>
                    <p>
                      这里演示“扫码 → 读取歌曲 → 确认使用”的完整界面流程。二维码是本地占位，不会登录酷狗或汽水账号，也不会读取第三方数据。
                    </p>
                    <div className="music-login__demo-steps" aria-label="演示连接状态">
                      <span className={demoFlowStatus !== 'ready' ? 'is-done' : 'is-active'}>扫码</span>
                      <span className={demoFlowStatus === 'reading' || demoFlowStatus === 'success' ? 'is-done' : demoFlowStatus === 'connecting' ? 'is-active' : ''}>连接</span>
                      <span className={demoFlowStatus === 'success' ? 'is-done' : demoFlowStatus === 'reading' ? 'is-active' : ''}>读取</span>
                    </div>
                    <span className="music-login__demo-status" data-demo-status={demoFlowStatus}>
                      <i aria-hidden="true" />
                      {demoStatusLabel}
                    </span>
                  </div>
                </div>
                {demoFlowStatus === 'success' ? (
                  <div className="music-login__demo-track" data-testid="demo-track-result">
                    <span className="music-login__demo-track-art" aria-hidden="true">♪</span>
                    <span>
                      <strong>{HIGH_SCHOOL_DEMO_TRACK.name}</strong>
                      <small>{HIGH_SCHOOL_DEMO_TRACK.artist} · {HIGH_SCHOOL_DEMO_TRACK.album}</small>
                    </span>
                  </div>
                ) : null}
                <div className="music-login__actions">
                  {demoFlowStatus === 'success' ? (
                    <button className="primary-action" type="button" onClick={confirmDemoTrack}>
                      使用这首音乐生成记忆宇宙
                    </button>
                  ) : (
                    <button className="primary-action" type="button" onClick={startDemoFlow} disabled={demoFlowStatus !== 'ready'}>
                      {demoFlowStatus === 'ready' ? '开始演示扫码' : '演示连接中…'}
                    </button>
                  )}
                  <button
                    className="secondary-action"
                    type="button"
                    onClick={() => {
                      stopDemoFlow();
                      setDemoSource(null);
                      setProvider('netease');
                      if (provider === 'netease') void refresh();
                      else setMode('loading');
                    }}
                  >
                    返回可连接平台
                  </button>
                </div>
                <p className="music-login__recovery">本地预置音频可播放、可进入演示、可用于导出，不会上传私人照片或账号 Cookie。</p>
              </div>
            ) : account?.loggedIn ? (
              <div className="music-login__connected" role="status" aria-live="polite">
                <div className="music-login__account-row">
                  {account.avatar ? (
                    <img src={account.avatar} alt="" />
                  ) : (
                    <span className="music-login__avatar-fallback" aria-hidden="true">
                      <ProviderMark provider={provider} />
                    </span>
                  )}
                  <div>
                    <strong>{account.nickname || '已登录账号'}</strong>
                    <span>{account.vipLabel || (account.isSvip ? 'SVIP' : account.isVip ? 'VIP' : '已连接')}</span>
                  </div>
                  <span className="music-login__account-check" aria-hidden="true" />
                </div>
                <p>歌单、队列和播放地址会通过本机服务读取。退出后，这个平台的会话和账号胶囊会一起清除。</p>
                <div className="music-login__actions">
                  <button className="primary-action" type="button" onClick={onClose}>
                    继续使用
                  </button>
                  <button className="secondary-action" type="button" onClick={() => void handleLogout()} disabled={busy}>
                    退出并切换
                  </button>
                </div>
              </div>
            ) : mode === 'qr' && qrCode && provider === 'netease' ? (
              <div className="music-login__qr-panel">
                <div className="music-login__method-label">BROWSER FALLBACK / REAL QR</div>
                <div className="music-login__qr-frame">
                  <img src={qrCode.image} alt="网易云音乐登录二维码" />
                </div>
                <strong>用网易云音乐 App 扫码</strong>
                <span className="music-login__qr-status" role="status" aria-live="polite">{qrStatus}</span>
                <p>二维码由本机音乐服务生成。若运行在 MEMENTO 桌面环境，推荐改用官方登录窗口。</p>
                <div className="music-login__actions">
                  <button className="secondary-action" type="button" onClick={() => void startNeteaseQr()} disabled={busy}>
                    刷新二维码
                  </button>
                  {desktopAvailable && (
                    <button className="text-button" type="button" onClick={() => setMode('desktop')}>
                      改用官方窗口
                    </button>
                  )}
                  <button className="text-button" type="button" onClick={() => setMode('cookie')}>
                    Cookie 导入
                  </button>
                </div>
              </div>
            ) : mode === 'desktop' ? (
              <div className="music-login__method-panel">
                <div className="music-login__method-label">OFFICIAL WEB BRIDGE</div>
                <span className="music-login__method-icon" aria-hidden="true"><span /></span>
                <strong>官方扫码登录</strong>
                <p>
                  {desktopAvailable
                    ? '打开平台官方网页登录窗口，在官方页面完成扫码或登录。成功后会自动同步账号会话和播放授权。'
                    : '当前是浏览器预览环境，无法自动接管官方网页登录会话。请使用本机二维码或 Cookie 导入。'}
                </p>
                <button
                  className="primary-action"
                  type="button"
                  onClick={() => void handleDesktopLogin()}
                  disabled={busy || !desktopAvailable}
                >
                  {busy ? '等待官方登录…' : '打开官方登录窗口'}
                </button>
                <div className="music-login__method-links">
                  {canUseBrowserQr && (
                    <button className="text-button" type="button" onClick={() => setMode('qr')}>
                      使用应用内二维码
                    </button>
                  )}
                  {provider === 'netease' && !desktopAvailable && (
                    <button className="text-button" type="button" onClick={() => void startNeteaseQr()} disabled={busy}>
                      生成应用内二维码
                    </button>
                  )}
                  <button className="text-button" type="button" onClick={() => setMode('cookie')}>
                    Cookie 导入
                  </button>
                </div>
              </div>
            ) : mode === 'cookie' ? (
              <div className="music-login__cookie-panel">
                <div className="music-login__method-label">ADVANCED / LOCAL ONLY</div>
                <strong>导入 {providerName} 登录状态</strong>
                <p>Cookie 只会直传本机音乐服务，成功后输入框会立即清空。不要在公共设备或截图中暴露它。</p>
                <textarea
                  value={cookie}
                  onChange={(event) => setCookie(event.target.value)}
                  placeholder={'粘贴 ' + providerName + ' Cookie'}
                  spellCheck={false}
                  autoComplete="off"
                  aria-label={providerName + ' Cookie'}
                />
                <button className="primary-action" type="button" onClick={() => void handleCookieLogin()} disabled={busy || !cookie.trim()}>
                  {busy ? '正在连接…' : '安全导入并连接'}
                </button>
                <div className="music-login__method-links">
                  {provider === 'netease' && (
                    <button className="text-button" type="button" onClick={() => void startNeteaseQr()} disabled={busy}>
                      返回二维码登录
                    </button>
                  )}
                  {desktopAvailable && (
                    <button className="text-button" type="button" onClick={() => setMode('desktop')}>
                      返回官方登录窗口
                    </button>
                  )}
                </div>
              </div>
            ) : mode === 'offline' ? (
              <div className="music-login__method-panel music-login__method-panel--error">
                <div className="music-login__method-label">CONNECTION ERROR</div>
                <span className="music-login__method-icon music-login__method-icon--error" aria-hidden="true"><span /></span>
                <strong>本地音乐连接器不可用</strong>
                <p>{error || '请确认 MEMENTO Music Connector 正在运行，或修改下方的服务地址。'}</p>
                <p className="music-login__recovery">
                  开发预览请运行 <code>pnpm dev</code>；单独启动连接器请运行 <code>pnpm run music:connector</code>。
                  连接成功后会生成真实的网易云二维码，二维码、登录会话均只保留在本机。
                </p>
                <button className="primary-action" type="button" onClick={() => void refresh()} disabled={busy}>
                  {busy ? '正在重试…' : '重新连接'}
                </button>
                <div className="music-login__method-links">
                  {provider === 'netease' && (
                    <button className="text-button" type="button" onClick={() => void refresh()} disabled={busy}>
                      连接后生成二维码
                    </button>
                  )}
                  <button className="text-button" type="button" onClick={() => setMode('cookie')}>
                    Cookie 导入
                  </button>
                </div>
              </div>
            ) : (
              <div className="music-login__loading" role="status" aria-live="polite">
                <span className="music-login__loading-line" />
                <span>正在检查 {providerName} 的连接状态…</span>
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
            <p>默认地址为 http://127.0.0.1:3000。MEMENTO Music Connector 只在本机处理二维码、登录会话和播放授权，不保存你的原始 Cookie 到前端。</p>
          </div>
        </details>
      </section>
    </div>
  );
}
