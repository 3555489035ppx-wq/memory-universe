import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  getMusicAccountStatus,
  getMusicStream,
  invalidateMusicStream,
  requestNeteaseQr,
} from './musicService';

afterEach(() => {
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

describe('musicService connector contract', () => {
  it('turns a browser fetch failure into an actionable local-connector recovery message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await expect(getMusicAccountStatus('netease')).rejects.toThrow(
      'pnpm run music:connector',
    );
  });

  it('requests key and QR image from the local connector instead of inventing a QR code in the browser', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ key: 'real-key' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ img: 'data:image/png;base64,ZmFrZQ==', url: 'https://music.163.com/login' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(requestNeteaseQr()).resolves.toEqual({
      key: 'real-key',
      image: 'data:image/png;base64,ZmFrZQ==',
      loginUrl: 'https://music.163.com/login',
    });
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      'http://127.0.0.1:3000/api/login/qr/key',
      'http://127.0.0.1:3000/api/login/qr/create?key=real-key',
    ]);
  });

  it('deduplicates concurrent lossless stream requests while a selected song is being prepared', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        url: 'https://music.example.test/track.flac',
        playable: true,
        quality: 'lossless',
      }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const track = {
      id: 'stream-cache-regression',
      remoteId: 'stream-cache-regression',
      name: 'Prepared track',
      fileName: 'Prepared track',
      src: '',
      source: 'remote' as const,
      provider: 'netease' as const,
    };

    const [first, second] = await Promise.all([
      getMusicStream(track),
      getMusicStream(track),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first).toEqual(second);
    expect(first.proxiedUrl).toContain('/api/audio?url=');
  });

  it('requests a new signed stream after an expired URL is invalidated', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        url: 'https://music.example.test/old.flac',
        playable: true,
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        url: 'https://music.example.test/fresh.flac',
        playable: true,
      }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const track = {
      id: 'stream-invalidation-regression',
      remoteId: 'stream-invalidation-regression',
      name: 'Refresh track',
      fileName: 'Refresh track',
      src: '',
      source: 'remote' as const,
      provider: 'netease' as const,
    };

    const first = await getMusicStream(track);
    invalidateMusicStream(track);
    const second = await getMusicStream(track);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(first.url).toContain('old.flac');
    expect(second.url).toContain('fresh.flac');
  });
});
