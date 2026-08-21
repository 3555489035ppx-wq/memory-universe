import { mkdtemp, rm } from 'node:fs/promises';
import type { Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  createMementoMusicConnector,
  normalizeNeteaseCdnUrl,
  type NeteaseConnectorApi,
} from '../../../scripts/memento-music-connector.mjs';

let server: Server | undefined;
let dataDirectory: string | undefined;

async function startConnector(api: NeteaseConnectorApi): Promise<string> {
  dataDirectory = await mkdtemp(join(tmpdir(), 'memento-music-connector-'));
  server = createMementoMusicConnector({ api, dataDirectory });
  await new Promise<void>((resolve, reject) => {
    server?.once('error', reject);
    server?.listen(0, '127.0.0.1', () => {
      server?.off('error', reject);
      resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Connector did not expose a TCP address.');
  return `http://127.0.0.1:${String(address.port)}`;
}

afterEach(async () => {
  if (server) await new Promise<void>((resolve) => server?.close(() => resolve()));
  if (dataDirectory) await rm(dataDirectory, { recursive: true, force: true });
  server = undefined;
  dataDirectory = undefined;
});

describe('MEMENTO Music Connector', () => {
  it('upgrades known Netease CDN HTTP stream URLs to HTTPS before proxying', () => {
    expect(normalizeNeteaseCdnUrl('http://m801.music.126.net/song.flac?token=test')).toBe(
      'https://m801.music.126.net/song.flac?token=test',
    );
    expect(normalizeNeteaseCdnUrl('https://m801.music.126.net/song.flac?token=test')).toBe(
      'https://m801.music.126.net/song.flac?token=test',
    );
    expect(normalizeNeteaseCdnUrl('https://example.com/song.flac')).toBeNull();
  });

  it('generates a real QR contract, persists only local session data, and never returns the cookie', async () => {
    const api: NeteaseConnectorApi = {
      login_qr_key: () => Promise.resolve({ body: { data: { unikey: 'test-qr-key' } } }),
      login_qr_create: () => Promise.resolve({ body: { data: { qrimg: 'data:image/png;base64,ZmFrZQ==', qrurl: 'https://music.163.com/login' } } }),
      login_qr_check: () => Promise.resolve({ body: { code: 803, message: '授权成功' }, cookie: ['MUSIC_U=private-session; Path=/; HttpOnly'] }),
      login_status: ({ cookie }) => Promise.resolve({
        body: cookie
          ? { code: 200, data: { account: { id: 7, vipType: 11 }, profile: { nickname: '本机账户', avatarUrl: 'https://p1.music.126.net/a.jpg' } } }
          : { code: 200, data: { account: null, profile: null } },
      }),
    };
    const baseUrl = await startConnector(api);

    const health = await fetch(`${baseUrl}/api/health`).then((response) => response.json());
    expect(health).toMatchObject({ ok: true, providers: { netease: { qr: true } } });

    const key = await fetch(`${baseUrl}/api/login/qr/key`).then((response) => response.json() as Promise<{ key: string }>);
    expect(key).toEqual({ key: 'test-qr-key' });

    const qr = await fetch(`${baseUrl}/api/login/qr/create?key=${key.key}`).then((response) => response.json() as Promise<{ img: string }>);
    expect(qr.img).toMatch(/^data:image\/png/);

    const checked = await fetch(`${baseUrl}/api/login/qr/check?key=${key.key}`).then((response) => response.json());
    expect(checked).toMatchObject({ code: 803, loggedIn: true, nickname: '本机账户', hasCookie: true });
    expect(JSON.stringify(checked)).not.toContain('private-session');

    const status = await fetch(`${baseUrl}/api/login/status`).then((response) => response.json());
    expect(status).toMatchObject({ loggedIn: true, isSvip: true, vipLabel: 'SVIP' });
    expect(JSON.stringify(status)).not.toContain('private-session');
  });

  it('does not become an unrestricted local proxy or a fake QQ login service', async () => {
    const baseUrl = await startConnector({ login_status: () => Promise.resolve({ body: { data: {} } }) });

    const blockedProxy = await fetch(`${baseUrl}/api/audio?url=https%3A%2F%2Fexample.com%2Faudio.mp3`);
    expect(blockedProxy.status).toBe(400);

    const qq = await fetch(`${baseUrl}/api/qq/login/status`);
    expect(qq.status).toBe(501);
    await expect(qq.json()).resolves.toMatchObject({ error: expect.stringContaining('QQ 音乐') });
  });
});
