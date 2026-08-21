import type { MusicTrack } from '../../stores/musicStore';

export type MusicProvider = 'netease' | 'qq';

export interface MusicAccount {
  provider: MusicProvider;
  loggedIn: boolean;
  userId?: string | number;
  nickname?: string;
  avatar?: string;
  isVip?: boolean;
  isSvip?: boolean;
  vipLabel?: string;
}

export interface MusicPlaylist {
  provider: MusicProvider;
  id: string;
  name: string;
  cover: string;
  trackCount: number;
  playCount: number;
  creator: string;
  subscribed: boolean;
}

export interface NeteaseQrCode {
  key: string;
  image: string;
  loginUrl?: string;
}

export interface NeteaseQrStatus {
  code: number;
  message: string;
  account?: MusicAccount;
}

export interface MusicStream {
  url: string;
  playable: boolean;
  quality?: string;
  proxiedUrl: string;
}

interface DesktopLoginResult {
  ok?: boolean;
  cookie?: string;
  cancelled?: boolean;
  error?: string;
}

interface DesktopWindowBridge {
  isDesktop?: boolean;
  openNeteaseMusicLogin?: () => Promise<DesktopLoginResult>;
  clearNeteaseMusicLogin?: () => Promise<unknown>;
  openQQMusicLogin?: () => Promise<DesktopLoginResult>;
  clearQQMusicLogin?: () => Promise<unknown>;
}

declare global {
  interface Window {
    desktopWindow?: DesktopWindowBridge;
  }
}

const DEFAULT_MUSIC_API_BASE_URL = 'http://127.0.0.1:3000';
const MUSIC_API_BASE_STORAGE_KEY = 'memento.music.apiBase';
const CONNECTOR_REQUEST_ATTEMPTS = 3;
const CONNECTOR_REQUEST_TIMEOUT_MS = 8_000;
const RETRYABLE_CONNECTOR_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
const MUSIC_STREAM_CACHE_TTL_MS = 90_000;

interface MusicStreamCacheEntry {
  expiresAt: number;
  request: Promise<MusicStream>;
}

const musicStreamCache = new Map<string, MusicStreamCacheEntry>();

function musicStreamCacheKey(track: MusicTrack): string {
  const provider = track.provider ?? 'netease';
  const remoteId = track.remoteId ?? track.id;
  return [getMusicApiBaseUrl(), provider, remoteId, track.mediaMid ?? ''].join('|');
}

export class MusicApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MusicApiError';
  }
}

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

export function getMusicApiBaseUrl(): string {
  const env = import.meta.env as unknown as Record<string, unknown>;
  const envBaseUrl = typeof env.VITE_MUSIC_API_BASE_URL === 'string' ? env.VITE_MUSIC_API_BASE_URL : '';
  let storedBaseUrl = '';
  if (typeof window !== 'undefined') {
    try {
      storedBaseUrl = window.localStorage.getItem(MUSIC_API_BASE_STORAGE_KEY) ?? '';
    } catch {
      storedBaseUrl = '';
    }
  }
  return normalizeBaseUrl(storedBaseUrl || envBaseUrl || DEFAULT_MUSIC_API_BASE_URL);
}

export function saveMusicApiBaseUrl(value: string): string {
  const nextBaseUrl = normalizeBaseUrl(value) || DEFAULT_MUSIC_API_BASE_URL;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(MUSIC_API_BASE_STORAGE_KEY, nextBaseUrl);
    } catch {
      // The connector remains usable when local storage is disabled.
    }
  }
  return nextBaseUrl;
}

function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function providerPath(provider: MusicProvider, path: string): string {
  return provider === 'qq' ? `/api/qq${path}` : `/api${path}`;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set('Accept', 'application/json');
  if (init?.body) headers.set('Content-Type', 'application/json');
  const apiBaseUrl = getMusicApiBaseUrl();
  let lastFailure: unknown = null;
  for (let attempt = 0; attempt < CONNECTOR_REQUEST_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), CONNECTOR_REQUEST_TIMEOUT_MS);
    const forwardAbort = (): void => controller.abort(init?.signal?.reason);
    init?.signal?.addEventListener('abort', forwardAbort, { once: true });
    try {
      const response = await fetch(`${apiBaseUrl}${path}`, {
        ...init,
        credentials: 'omit',
        headers,
        signal: controller.signal,
      });
      const rawText = await response.text();
      let data: unknown = null;
      try {
        data = rawText ? (JSON.parse(rawText) as unknown) : null;
      } catch {
        data = null;
      }

      if (response.ok) return data as T;
      const body = data as { message?: unknown; error?: unknown } | null;
      const message = asString(body?.message ?? body?.error, `音乐服务返回 ${String(response.status)}`);
      if (RETRYABLE_CONNECTOR_STATUSES.has(response.status) && attempt + 1 < CONNECTOR_REQUEST_ATTEMPTS) {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 260 * (attempt + 1)));
        continue;
      }
      throw new MusicApiError(message);
    } catch (error) {
      if (error instanceof MusicApiError) throw error;
      lastFailure = error;
      if (init?.signal?.aborted) throw new MusicApiError('音乐请求已取消。');
      if (attempt + 1 < CONNECTOR_REQUEST_ATTEMPTS) {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 260 * (attempt + 1)));
        continue;
      }
    } finally {
      window.clearTimeout(timeout);
      init?.signal?.removeEventListener('abort', forwardAbort);
    }
  }
  const reason = lastFailure instanceof DOMException && lastFailure.name === 'AbortError'
    ? '本地音乐连接器响应超时'
    : '无法连接 MEMENTO 本地音乐连接器';
  throw new MusicApiError(
    `${reason}（${apiBaseUrl}）。连接器会由开发环境自动恢复；如果仍未恢复，请点击“重新连接”或运行“pnpm run music:connector”。`,
  );
}

function normalizeAccount(provider: MusicProvider, value: unknown): MusicAccount {
  const data = (value ?? {}) as Record<string, unknown>;
  const account: MusicAccount = {
    provider,
    loggedIn: Boolean(data.loggedIn),
    nickname: asString(data.nickname),
    avatar: buildMusicCoverUrl(asString(data.avatar)),
    isVip: Boolean(data.isVip),
    isSvip: Boolean(data.isSvip),
    vipLabel: asString(data.vipLabel),
  };
  if (typeof data.userId === 'string' || typeof data.userId === 'number') account.userId = data.userId;
  return account;
}

export async function getMusicAccountStatus(provider: MusicProvider): Promise<MusicAccount> {
  const data = await requestJson<unknown>(providerPath(provider, '/login/status'));
  return normalizeAccount(provider, data);
}

function normalizePlaylist(provider: MusicProvider, value: unknown): MusicPlaylist {
  const data = (value ?? {}) as Record<string, unknown>;
  return {
    provider,
    id: asString(data.id ?? data.pid),
    name: asString(data.name, '未命名歌单'),
    cover: buildMusicCoverUrl(asString(data.coverImgUrl ?? data.cover ?? data.picUrl)),
    trackCount: asNumber(data.trackCount ?? data.songCount),
    playCount: asNumber(data.playCount),
    creator: asString((data.creator as Record<string, unknown> | undefined)?.nickname ?? data.creator),
    subscribed: Boolean(data.subscribed),
  };
}

export async function getMusicPlaylists(provider: MusicProvider): Promise<MusicPlaylist[]> {
  const data = await requestJson<unknown>(providerPath(provider, '/user/playlists'));
  const playlistValue = (data as { playlists?: unknown[] } | null)?.playlists;
  const rawPlaylists = Array.isArray(data)
    ? data
    : Array.isArray(playlistValue)
      ? playlistValue
      : [];
  return rawPlaylists.map((playlist) => normalizePlaylist(provider, playlist)).filter((playlist) => playlist.id);
}

function normalizeRemoteTrack(provider: MusicProvider, value: unknown): MusicTrack {
  const data = (value ?? {}) as Record<string, unknown>;
  const remoteId = asString(data.id ?? data.mid);
  const artist = asString(data.artist ?? data.artists);
  const duration = asNumber(data.duration);
  return {
    id: `${provider}:${remoteId}`,
    remoteId,
    mediaMid: asString(data.mediaMid),
    name: asString(data.name, '未命名歌曲'),
    fileName: asString(data.name, '未命名歌曲'),
    src: '',
    source: 'remote',
    provider,
    artist,
    album: asString(data.album),
    cover: buildMusicCoverUrl(asString(data.cover ?? data.coverImgUrl ?? data.picUrl)),
    duration,
  };
}

export async function getMusicPlaylistTracks(
  provider: MusicProvider,
  playlistId: string,
  options: { limit?: number; offset?: number } = {},
): Promise<{
  playlist: MusicPlaylist | null;
  tracks: MusicTrack[];
  offset: number;
  nextOffset: number;
  total: number;
  hasMore: boolean;
}> {
  const queryKey = provider === 'qq' ? 'id' : 'id';
  const params = new URLSearchParams({ [queryKey]: playlistId });
  if (options.limit !== undefined) params.set('limit', String(options.limit));
  if (options.offset !== undefined) params.set('offset', String(options.offset));
  const data = await requestJson<unknown>(
    `${providerPath(provider, '/playlist/tracks')}?${params.toString()}`,
  );
  const payload = (data ?? {}) as {
    playlist?: unknown;
    tracks?: unknown[];
    offset?: unknown;
    nextOffset?: unknown;
    total?: unknown;
    hasMore?: unknown;
  };
  const tracks = Array.isArray(payload.tracks)
    ? payload.tracks.map((track) => normalizeRemoteTrack(provider, track)).filter((track) => track.remoteId)
    : [];
  const playlist = payload.playlist ? normalizePlaylist(provider, payload.playlist) : null;
  const offset = asNumber(payload.offset, options.offset ?? 0);
  const nextOffset = asNumber(payload.nextOffset, offset + tracks.length);
  const total = asNumber(payload.total, playlist?.trackCount ?? 0);
  return {
    playlist,
    tracks,
    offset,
    nextOffset,
    total,
    hasMore: Boolean(payload.hasMore) || (total > 0 && nextOffset < total),
  };
}

async function requestMusicStream(track: MusicTrack): Promise<MusicStream> {
  const provider = track.provider ?? 'netease';
  const remoteId = track.remoteId ?? track.id;
  const params = new URLSearchParams();
  if (provider === 'qq') {
    params.set('mid', remoteId);
    if (track.mediaMid) params.set('mediaMid', track.mediaMid);
    params.set('quality', 'flac');
  } else {
    params.set('id', remoteId);
    // Ask the connector for the highest available lossless stream. The
    // service may downgrade when a track/account does not expose that level.
    params.set('level', 'lossless');
    params.set('encodeType', 'flac');
  }
  const data = await requestJson<unknown>(`${providerPath(provider, '/song/url')}?${params.toString()}`);
  const payload = (data ?? {}) as Record<string, unknown>;
  const url = asString(payload.url);
  if (!url || payload.playable === false) {
    throw new MusicApiError('这首歌暂时没有可用的播放地址。');
  }
  return {
    url,
    playable: payload.playable !== false,
    quality: asString(payload.quality),
    proxiedUrl: buildMusicAudioUrl(url),
  };
}

export function getMusicStream(track: MusicTrack): Promise<MusicStream> {
  const cacheKey = musicStreamCacheKey(track);
  const cached = musicStreamCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.request;

  const entry: MusicStreamCacheEntry = {
    expiresAt: Date.now() + MUSIC_STREAM_CACHE_TTL_MS,
    request: requestMusicStream(track),
  };
  musicStreamCache.set(cacheKey, entry);
  void entry.request.catch(() => {
    if (musicStreamCache.get(cacheKey) === entry) musicStreamCache.delete(cacheKey);
  });
  return entry.request;
}

export function invalidateMusicStream(track: MusicTrack): void {
  musicStreamCache.delete(musicStreamCacheKey(track));
}

export function buildMusicAudioUrl(url: string): string {
  const baseUrl = getMusicApiBaseUrl();
  return isLocalMusicService(baseUrl) ? `${baseUrl}/api/audio?url=${encodeURIComponent(url)}` : url;
}

function isLocalMusicService(baseUrl: string): boolean {
  try {
    const hostname = new URL(baseUrl).hostname;
    return hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '[::1]';
  } catch {
    return false;
  }
}

export function buildMusicCoverUrl(url: string): string {
  if (!url) return '';
  const baseUrl = getMusicApiBaseUrl();
  return isLocalMusicService(baseUrl) ? `${baseUrl}/api/cover?url=${encodeURIComponent(url)}` : url;
}

export async function requestNeteaseQr(): Promise<NeteaseQrCode> {
  const keyPayload = await requestJson<{ key?: unknown }>('/api/login/qr/key');
  const key = asString(keyPayload.key);
  if (!key) throw new MusicApiError('无法创建网易云登录二维码。');
  const qrPayload = await requestJson<{ img?: unknown; url?: unknown }>(
    `/api/login/qr/create?key=${encodeURIComponent(key)}`,
  );
  const image = asString(qrPayload.img);
  if (!image) throw new MusicApiError('网易云二维码为空，请稍后重试。');
  return { key, image, loginUrl: asString(qrPayload.url) };
}

export async function checkNeteaseQr(key: string): Promise<NeteaseQrStatus> {
  const data = await requestJson<{ code?: unknown; message?: unknown }>(
    `/api/login/qr/check?key=${encodeURIComponent(key)}`,
  );
  return {
    code: asNumber(data.code),
    message: asString(data.message, '等待扫码'),
  };
}

export async function submitMusicCookie(provider: MusicProvider, cookie: string): Promise<MusicAccount> {
  const value = cookie.trim();
  if (!value) throw new MusicApiError('请先粘贴 Cookie。');
  const cookieParts = value.split(';').map((part) => part.trim()).filter(Boolean);
  const hasCookieKey = (keys: string[]): boolean =>
    cookieParts.some((part) => {
      const separator = part.indexOf('=');
      if (separator <= 0) return false;
      return keys.includes(part.slice(0, separator).trim());
    });
  if (cookieParts.length === 0 || !cookieParts.some((part) => part.includes('='))) {
    throw new MusicApiError('Cookie 格式无效，请粘贴完整的 Cookie 字符串。');
  }
  if (provider === 'netease' && !hasCookieKey(['MUSIC_U'])) {
    throw new MusicApiError('网易云 Cookie 缺少 MUSIC_U，请重新复制登录后的 Cookie。');
  }
  if (
    provider === 'qq' &&
    (!hasCookieKey(['uin', 'qqmusic_uin', 'p_uin', 'wxuin']) ||
      !hasCookieKey(['qm_keyst', 'qqmusic_key', 'music_key', 'wxskey']))
  ) {
    throw new MusicApiError('QQ 音乐 Cookie 缺少账号或播放授权字段，请使用官方登录窗口重新授权。');
  }
  await requestJson<unknown>(providerPath(provider, '/login/cookie'), {
    method: 'POST',
    body: JSON.stringify({ cookie: value }),
  });
  return getMusicAccountStatus(provider);
}

export async function logoutMusicProvider(provider: MusicProvider): Promise<void> {
  await requestJson<unknown>(providerPath(provider, '/login/logout'), { method: 'POST' });
}

export async function clearDesktopMusicLogin(provider: MusicProvider): Promise<void> {
  if (typeof window === 'undefined') return;
  const bridge = window.desktopWindow;
  const clearLogin = provider === 'qq' ? bridge?.clearQQMusicLogin : bridge?.clearNeteaseMusicLogin;
  if (typeof clearLogin !== 'function') return;
  await clearLogin();
}

export function hasDesktopMusicLogin(provider: MusicProvider): boolean {
  if (typeof window === 'undefined') return false;
  const bridge = window.desktopWindow;
  return provider === 'qq'
    ? typeof bridge?.openQQMusicLogin === 'function'
    : typeof bridge?.openNeteaseMusicLogin === 'function';
}

export async function openDesktopMusicLogin(provider: MusicProvider): Promise<DesktopLoginResult> {
  if (typeof window === 'undefined') throw new MusicApiError('当前环境没有桌面登录能力。');
  const bridge = window.desktopWindow;
  const openLogin = provider === 'qq' ? bridge?.openQQMusicLogin : bridge?.openNeteaseMusicLogin;
  if (!openLogin) throw new MusicApiError('请在 MEMENTO 桌面环境中打开官方登录窗口。');
  return openLogin();
}

export function providerLabel(provider: MusicProvider): string {
  return provider === 'qq' ? 'QQ 音乐' : '网易云音乐';
}

export function providerShortLabel(provider: MusicProvider): string {
  return provider === 'qq' ? 'QQ' : 'NE';
}
