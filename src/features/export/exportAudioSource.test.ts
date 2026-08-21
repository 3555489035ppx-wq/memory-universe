import { afterEach, describe, expect, it, vi } from 'vitest';

import { materializeTrackAudio } from './exportAudioSource';

const localFile = new File([new Uint8Array([1, 2, 3])], 'local-song.mp3', { type: 'audio/mpeg' });

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('materializeTrackAudio', () => {
  it('keeps a local file on the local export path', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    await expect(materializeTrackAudio({ id: 'local', name: '本地', fileName: localFile.name, src: 'blob:local', source: 'local', localFile })).resolves.toBe(localFile);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('downloads a remote playback source into a File for offline mastering', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(new Uint8Array([4, 5, 6]), { status: 200, headers: { 'Content-Type': 'audio/flac' } }))));
    const file = await materializeTrackAudio({ id: 'remote', name: '远程歌曲', fileName: 'remote.flac', src: 'http://127.0.0.1:3000/api/audio?url=stream', source: 'remote' });

    expect(file.name).toBe('remote.flac');
    expect(file.type).toBe('audio/flac');
    expect(file.size).toBe(3);
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledWith(
      'http://127.0.0.1:3000/api/audio?url=stream',
      expect.objectContaining({ credentials: 'omit', cache: 'no-store' }),
    );
  });

  it('reports a useful error for an empty remote stream', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(new Uint8Array(), { status: 200, headers: { 'Content-Type': 'audio/mpeg' } }))));
    await expect(materializeTrackAudio({ id: 'remote', name: '远程歌曲', fileName: 'remote.mp3', src: 'https://example.test/song.mp3', source: 'remote' })).rejects.toThrow('空音频');
  });
});
