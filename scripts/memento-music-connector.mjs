import { createServer } from 'node:http';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Readable } from 'node:stream';

import neteaseModule from 'NeteaseCloudMusicApi';

const DEFAULT_PORT = 3000;
const MAX_REQUEST_BYTES = 32 * 1024;
const NETEASE_RETRY_LIMIT = 3;
const NETEASE_CDN_HOSTS = [
  'music.126.net',
  'music.163.com',
  'music.163cn.tv',
];
const NETEASE_LEVELS = new Set([
  'standard',
  'higher',
  'exhigh',
  'lossless',
  'hires',
  'jyeffect',
  'sky',
  'jymaster',
]);

function defaultDataDirectory() {
  const localAppData = process.env.LOCALAPPDATA?.trim();
  const base = localAppData || join(homedir(), 'AppData', 'Local');
  return join(base, 'Memento', 'music-connector');
}

function getCookieFile(dataDirectory) {
  return join(dataDirectory, 'netease-session.json');
}

function asString(value, fallback = '') {
  return typeof value === 'string' ? value : typeof value === 'number' ? String(value) : fallback;
}

function asNumber(value, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asRecord(value) {
  return value && typeof value === 'object' ? value : {};
}

function toCookieHeader(value) {
  const entries = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
  return entries
    .map((item) => asString(item).split(';')[0]?.trim() ?? '')
    .filter(Boolean)
    .join('; ');
}

function serviceError(message, status = 500) {
  return Object.assign(new Error(message), { status });
}

function sendJson(response, status, value) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(value));
}

function applyCorsHeaders(response) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Range');
  response.setHeader('Vary', 'Origin');
  response.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
}

function isAllowedNeteaseCdnHost(hostname) {
  return NETEASE_CDN_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`));
}

export function normalizeNeteaseCdnUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (!isAllowedNeteaseCdnHost(url.hostname)) return null;
    if (url.protocol === 'http:') url.protocol = 'https:';
    return url.toString();
  } catch {
    return null;
  }
}

function getProxyContentType(remoteUrl, upstreamContentType) {
  try {
    const pathname = new URL(remoteUrl).pathname.toLowerCase();
    if (pathname.endsWith('.flac')) return 'audio/flac';
  } catch {
    // The URL was already validated before this helper is called.
  }
  return upstreamContentType;
}

function normalizeAccount(value) {
  const body = asRecord(value);
  const data = asRecord(body.data);
  const account = asRecord(data.account ?? body.account);
  const profile = asRecord(data.profile ?? body.profile);
  const userId = account.id ?? account.userId ?? profile.userId ?? profile.id;
  const vipType = asNumber(account.vipType ?? data.vipType);
  const isVip = vipType > 0 || Boolean(account.vipType);
  const isSvip = vipType >= 11;
  const result = {
    loggedIn: Boolean(userId),
    isVip,
    isSvip,
    vipLabel: isSvip ? 'SVIP' : isVip ? 'VIP' : '已连接',
  };
  if (typeof userId === 'string' || typeof userId === 'number') {
    return {
      ...result,
      userId,
      nickname: asString(profile.nickname ?? account.nickname),
      avatar: asString(profile.avatarUrl ?? profile.avatar),
    };
  }
  return result;
}

function normalizePlaylist(value) {
  const item = asRecord(value);
  const creator = asRecord(item.creator);
  return {
    id: asString(item.id),
    name: asString(item.name, '未命名歌单'),
    cover: asString(item.coverImgUrl ?? item.picUrl),
    trackCount: asNumber(item.trackCount),
    playCount: asNumber(item.playCount),
    creator: asString(creator.nickname),
    subscribed: Boolean(item.subscribed),
  };
}

function normalizeTrack(value) {
  const item = asRecord(value);
  const album = asRecord(item.al ?? item.album);
  const artists = Array.isArray(item.ar) ? item.ar : Array.isArray(item.artists) ? item.artists : [];
  return {
    id: asString(item.id),
    name: asString(item.name, '未命名歌曲'),
    artist: artists.map((artist) => asString(asRecord(artist).name)).filter(Boolean).join(' / '),
    album: asString(album.name),
    cover: asString(album.picUrl ?? album.coverImgUrl),
    duration: asNumber(item.dt ?? item.duration),
  };
}

async function readJsonBody(request) {
  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += bytes.byteLength;
    if (total > MAX_REQUEST_BYTES) throw serviceError('请求体过大。', 413);
    chunks.push(bytes);
  }
  if (chunks.length === 0) return {};
  try {
    return asRecord(JSON.parse(Buffer.concat(chunks).toString('utf8')));
  } catch {
    throw serviceError('请求体不是有效 JSON。', 400);
  }
}

async function readSession(file) {
  try {
    const parsed = JSON.parse(await readFile(file, 'utf8'));
    return asString(asRecord(parsed).cookie);
  } catch {
    return '';
  }
}

async function saveSession(file, cookie) {
  await mkdir(dirname(file), { recursive: true });
  const temporaryFile = `${file}.${String(process.pid)}.tmp`;
  const payload = JSON.stringify({ cookie, updatedAt: new Date().toISOString() });
  try {
    await writeFile(temporaryFile, payload, { encoding: 'utf8', mode: 0o600 });
    try {
      await rename(temporaryFile, file);
    } catch {
      // Some Windows security tools briefly hold the old file open. Keep the
      // session durable instead of turning a replace failure into a logout.
      await writeFile(file, payload, { encoding: 'utf8', mode: 0o600 });
    }
  } finally {
    await unlink(temporaryFile).catch(() => undefined);
  }
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function callNetease(api, method, input) {
  const handler = api[method];
  if (typeof handler !== 'function') throw serviceError(`网易云接口 ${method} 不可用。`, 503);
  let lastError;
  for (let attempt = 0; attempt < NETEASE_RETRY_LIMIT; attempt += 1) {
    try {
      return await handler(input);
    } catch (error) {
      lastError = error;
      if (attempt + 1 >= NETEASE_RETRY_LIMIT) break;
      await delay(260 * (attempt + 1));
    }
  }
  throw lastError instanceof Error ? lastError : new Error('网易云服务暂时不可用。');
}

async function requestAllowedRemote(url, requestHeaders, attempts = 0) {
  const normalizedUrl = normalizeNeteaseCdnUrl(url);
  if (!normalizedUrl) throw serviceError('只允许代理网易云音乐 CDN 的图片和音频。', 400);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  let response;
  try {
    response = await fetch(normalizedUrl, { headers: requestHeaders, redirect: 'manual', signal: controller.signal });
  } catch (error) {
    if (attempts >= 2) throw serviceError('音乐源连接超时，请稍后重试。', 504);
    await delay(220 * (attempts + 1));
    return requestAllowedRemote(normalizedUrl, requestHeaders, attempts + 1);
  } finally {
    clearTimeout(timeout);
  }
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('location');
    if (!location || attempts >= 3) throw serviceError('音频源重定向失败。', 502);
    return requestAllowedRemote(new URL(location, normalizedUrl).toString(), requestHeaders, attempts + 1);
  }
  return response;
}

export function createMementoMusicConnector({
  api = neteaseModule,
  dataDirectory = defaultDataDirectory(),
} = {}) {
  const sessionFile = getCookieFile(dataDirectory);
  let sessionPromise = null;
  let knownSessionCookie = '';
  let lastKnownAccount = null;

  const getSession = () => {
    sessionPromise ??= readSession(sessionFile);
    return sessionPromise;
  };

  const setSession = async (cookie) => {
    sessionPromise = Promise.resolve(cookie);
    knownSessionCookie = cookie;
    lastKnownAccount = null;
    await saveSession(sessionFile, cookie);
  };

  const getLoginStatus = async (cookie, { allowStale = false } = {}) => {
    if (!cookie) return normalizeAccount({});
    try {
      const result = await callNetease(api, 'login_status', { cookie, timestamp: Date.now() });
      const account = normalizeAccount(result.body);
      if (account.loggedIn) {
        knownSessionCookie = cookie;
        lastKnownAccount = account;
      }
      return account;
    } catch (error) {
      // A transient profile/status outage must not make a valid local session
      // look logged out. The next authenticated request still revalidates the
      // upstream session, while the UI can keep the account connected.
      if (allowStale && knownSessionCookie === cookie && lastKnownAccount?.loggedIn) {
        return { ...lastKnownAccount, stale: true };
      }
      throw error;
    }
  };

  const requireLogin = async () => {
    const cookie = await getSession();
    if (!cookie) throw serviceError('请先完成网易云登录。', 401);
    const account = await getLoginStatus(cookie, { allowStale: true });
    if (!account.loggedIn) throw serviceError('本机登录会话已失效，请重新扫码。', 401);
    return { cookie, account };
  };

  const server = createServer(async (request, response) => {
    applyCorsHeaders(response);
    if (request.method === 'OPTIONS') {
      response.statusCode = 204;
      response.end();
      return;
    }

    try {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1');
      const path = url.pathname;
      if (path === '/api/health' && request.method === 'GET') {
        sendJson(response, 200, {
          ok: true,
          service: 'memento-music-connector',
          providers: { netease: { qr: true, cookie: true }, qq: { desktop: true, cookie: false } },
        });
        return;
      }

      if (path.startsWith('/api/qq/')) {
        throw serviceError('QQ 音乐请使用桌面端官方登录桥接；MEMENTO 本地连接器不伪造 QQ 登录或播放授权。', 501);
      }

      if (path === '/api/login/status' && request.method === 'GET') {
        sendJson(response, 200, await getLoginStatus(await getSession(), { allowStale: true }));
        return;
      }

      if (path === '/api/login/qr/key' && request.method === 'GET') {
        const result = await callNetease(api, 'login_qr_key', { timestamp: Date.now() });
        const key = asString(asRecord(asRecord(result.body).data).unikey);
        if (!key) throw serviceError('网易云没有返回二维码 key。', 502);
        sendJson(response, 200, { key });
        return;
      }

      if (path === '/api/login/qr/create' && request.method === 'GET') {
        const key = url.searchParams.get('key')?.trim();
        if (!key) throw serviceError('缺少二维码 key。', 400);
        const result = await callNetease(api, 'login_qr_create', { key, qrimg: true, timestamp: Date.now() });
        const data = asRecord(asRecord(result.body).data);
        const img = asString(data.qrimg);
        if (!img) throw serviceError('网易云没有返回二维码图片。', 502);
        sendJson(response, 200, { img, url: asString(data.qrurl) });
        return;
      }

      if (path === '/api/login/qr/check' && request.method === 'GET') {
        const key = url.searchParams.get('key')?.trim();
        if (!key) throw serviceError('缺少二维码 key。', 400);
        const result = await callNetease(api, 'login_qr_check', { key, timestamp: Date.now() });
        const body = asRecord(result.body);
        const code = asNumber(body.code);
        const cookie = toCookieHeader(result.cookie);
        if (code === 803 && cookie) await setSession(cookie);
        const account = code === 803 && cookie ? await getLoginStatus(cookie) : undefined;
        sendJson(response, 200, {
          code,
          message: asString(body.message),
          ...(account ?? {}),
          hasCookie: Boolean(cookie),
        });
        return;
      }

      if (path === '/api/login/cookie' && request.method === 'POST') {
        const cookie = asString((await readJsonBody(request)).cookie).trim();
        if (!cookie) throw serviceError('请提供有效的网易云 Cookie。', 400);
        const account = await getLoginStatus(cookie);
        if (!account.loggedIn) throw serviceError('Cookie 未通过网易云登录校验，请重新在官方页面登录后再试。', 401);
        await setSession(cookie);
        sendJson(response, 200, account);
        return;
      }

      if (path === '/api/login/logout' && request.method === 'POST') {
        const cookie = await getSession();
        if (cookie) await callNetease(api, 'logout', { cookie, timestamp: Date.now() }).catch(() => undefined);
        await setSession('');
        sendJson(response, 200, { ok: true });
        return;
      }

      if (path === '/api/user/playlists' && request.method === 'GET') {
        const { cookie, account } = await requireLogin();
        const result = await callNetease(api, 'user_playlist', { uid: account.userId, limit: 1000, offset: 0, cookie, timestamp: Date.now() });
        const playlists = Array.isArray(asRecord(result.body).playlist)
          ? asRecord(result.body).playlist.map(normalizePlaylist)
          : [];
        sendJson(response, 200, { playlists });
        return;
      }

      if (path === '/api/playlist/tracks' && request.method === 'GET') {
        const id = url.searchParams.get('id')?.trim();
        if (!id) throw serviceError('缺少歌单 id。', 400);
        const { cookie } = await requireLogin();
        const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? 48) || 48));
        const offset = Math.max(0, Number(url.searchParams.get('offset') ?? 0) || 0);
        const result = await callNetease(api, 'playlist_track_all', { id, limit, offset, cookie, timestamp: Date.now() });
        const body = asRecord(result.body);
        const tracks = Array.isArray(body.songs) ? body.songs.map(normalizeTrack) : [];
        sendJson(response, 200, {
          tracks,
          offset,
          nextOffset: offset + tracks.length,
          total: asNumber(body.total ?? body.trackCount, tracks.length),
          hasMore: tracks.length === limit,
        });
        return;
      }

      if (path === '/api/song/url' && request.method === 'GET') {
        const id = url.searchParams.get('id')?.trim();
        if (!id) throw serviceError('缺少歌曲 id。', 400);
        const { cookie } = await requireLogin();
        const requestedLevel = url.searchParams.get('level') ?? 'lossless';
        const level = NETEASE_LEVELS.has(requestedLevel) ? requestedLevel : 'lossless';
        // Keep the requested lossless-first behavior, but fall back through
        // the best formats the account actually exposes. A valid non-VIP
        // account must not look like a broken player just because it cannot
        // receive the first requested quality.
        const levels = [...new Set([level, 'lossless', 'hires', 'exhigh', 'higher', 'standard'])];
        let lastError = null;
        for (const candidateLevel of levels) {
          try {
            const result = await callNetease(api, 'song_url_v1', { id, level: candidateLevel, cookie, timestamp: Date.now() });
            const first = Array.isArray(asRecord(result.body).data) ? asRecord(result.body).data[0] : undefined;
            const stream = asRecord(first);
            const streamUrl = asString(stream.url);
            if (!streamUrl) continue;
            sendJson(response, 200, {
              url: streamUrl,
              playable: true,
              quality: asString(stream.level ?? stream.type ?? candidateLevel).toUpperCase(),
              bitrate: asNumber(stream.br),
            });
            return;
          } catch (error) {
            lastError = error;
          }
        }
        if (lastError && levels.length === 1) throw lastError;
        sendJson(response, 200, { url: null, playable: false, quality: level.toUpperCase(), bitrate: 0 });
        return;
      }

      if ((path === '/api/audio' || path === '/api/cover') && request.method === 'GET') {
        const remoteUrl = url.searchParams.get('url')?.trim() ?? '';
        const headers = new Headers();
        if (path === '/api/audio') {
          const range = request.headers.range;
          if (range) headers.set('Range', range);
        }
        const upstream = await requestAllowedRemote(remoteUrl, headers);
        response.statusCode = upstream.status;
        for (const header of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'cache-control']) {
          const value = header === 'content-type'
            ? getProxyContentType(remoteUrl, upstream.headers.get(header))
            : upstream.headers.get(header);
          if (value) response.setHeader(header, value);
        }
        if (!upstream.body) throw serviceError('上游媒体没有返回内容。', 502);
        Readable.fromWeb(upstream.body).pipe(response);
        return;
      }

      throw serviceError('没有匹配的本地音乐接口。', 404);
    } catch (reason) {
      const error = reason instanceof Error ? reason : new Error('本地音乐连接器发生未知错误。');
      if (!response.writableEnded) {
        try {
          sendJson(response, 'status' in error && typeof error.status === 'number' ? error.status : 500, {
            error: error.message,
          });
        } catch {
          response.destroy();
        }
      }
    }
  });
  server.keepAliveTimeout = 30_000;
  server.headersTimeout = 35_000;
  server.requestTimeout = 20_000;
  server.on('clientError', (_error, socket) => {
    if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
  });
  return server;
}

export async function startMementoMusicConnector() {
  const port = Number(process.env.MEMENTO_MUSIC_PORT ?? DEFAULT_PORT);
  const host = process.env.MEMENTO_MUSIC_HOST ?? '127.0.0.1';
  const server = createMementoMusicConnector();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      resolve();
    });
  });
  console.log(`MEMENTO Music Connector ready at http://${host}:${port}`);
  console.log(`Session data stays in ${join(defaultDataDirectory(), 'netease-session.json')}`);
  return server;
}

const isEntrypoint = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isEntrypoint) {
  startMementoMusicConnector().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
