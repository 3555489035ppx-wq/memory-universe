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
  const response = await fetch(`${getMusicApiBaseUrl()}${path}`, {
    ...init,
    credentials: 'omit',
    headers,
  });

  const rawText = await response.text();
  let data: unknown = null;
  try {
    data = rawText ? (JSON.parse(rawText) as unknown) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    const body = data as { message?: unknown; error?: unknown } | null;
    const message = asString(body?.message ?? body?.error, `音乐服务返回 ${String(response.status)}`);
    throw new MusicApiError(message);
  }

  return data as T;
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
): Promise<{ playlist: MusicPlaylist | null; tracks: MusicTrack[] }> {
  const queryKey = provider === 'qq' ? 'id' : 'id';
  const data = await requestJson<unknown>(
    `${providerPath(provider, '/playlist/tracks')}?${queryKey}=${encodeURIComponent(playlistId)}`,
  );
  const payload = (data ?? {}) as { playlist?: unknown; tracks?: unknown[] };
  const tracks = Array.isArray(payload.tracks)
    ? payload.tracks.map((track) => normalizeRemoteTrack(provider, track)).filter((track) => track.remoteId)
    : [];
  return {
    playlist: payload.playlist ? normalizePlaylist(provider, payload.playlist) : null,
    tracks,
  };
}

export async function getMusicStream(track: MusicTrack): Promise<MusicStream> {
  const provider = track.provider ?? 'netease';
  const remoteId = track.remoteId ?? track.id;
  const params = new URLSearchParams();
  if (provider === 'qq') {
    params.set('mid', remoteId);
    if (track.mediaMid) params.set('mediaMid', track.mediaMid);
    params.set('quality', 'flac');
  } else {
    params.set('id', remoteId);
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
  await requestJson<unknown>(providerPath(provider, '/login/cookie'), {
    method: 'POST',
    body: JSON.stringify({ cookie: value }),
  });
  return getMusicAccountStatus(provider);
}

export async function logoutMusicProvider(provider: MusicProvider): Promise<void> {
  await requestJson<unknown>(providerPath(provider, '/login/logout'), { method: 'POST' });
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
  if (!openLogin) throw new MusicApiError('请在 Mineradio 桌面环境中打开官方登录窗口。');
  return openLogin();
}

export function providerLabel(provider: MusicProvider): string {
  return provider === 'qq' ? 'QQ 音乐' : '网易云音乐';
}

export function providerShortLabel(provider: MusicProvider): string {
  return provider === 'qq' ? 'QQ' : 'NE';
}
