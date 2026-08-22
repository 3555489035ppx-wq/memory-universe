import { afterEach, describe, expect, it, vi } from 'vitest';

import { materializeTrackAudio } from './exportAudioSource';

const localFile = new File([new Uint8Array([1, 2, 3])], 'local-song.mp3', { type: 'audio/mpeg' });

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('materializeTrackAudio', () => {
  it('keeps a user upload on the local export path', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    await expect(materializeTrackAudio({ id: 'upload', name: '我的上传', fileName: localFile.name, src: 'blob:upload', source: 'upload', localFile })).resolves.toBe(localFile);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('downloads a bundled system source into a File for offline mastering', async () => {
    const audioBody = new Blob([new Uint8Array([4, 5, 6])], { type: 'audio/flac' });
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, status: 200, blob: () => Promise.resolve(audioBody) } as Response)));
    const file = await materializeTrackAudio({ id: 'system', name: '系统歌曲', fileName: 'system.flac', src: '/music/high-school/system.flac', source: 'system' });

    expect(file.name).toBe('system.flac');
    expect(file.type).toBe('audio/flac');
    expect(file.size).toBe(3);
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledWith(
      '/music/high-school/system.flac',
      expect.objectContaining({ credentials: 'omit', cache: 'no-store' }),
    );
  });

  it('reports a useful error for an empty system file', async () => {
    const emptyAudioBody = new Blob([], { type: 'audio/mpeg' });
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, status: 200, blob: () => Promise.resolve(emptyAudioBody) } as Response)));
    await expect(materializeTrackAudio({ id: 'system', name: '系统歌曲', fileName: 'system.mp3', src: '/music/high-school/system.mp3', source: 'system' })).rejects.toThrow('音频文件为空');
  });
});
