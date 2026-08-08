import { Texture } from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadLocalTexture, LocalTextureManager, type TextureLoader } from './LocalTextureManager';

function loaded(bytes = 8) {
  return { texture: new Texture(), byteEstimate: bytes };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('loadLocalTexture', () => {
  it('decodes ImageBitmap textures with the WebGL Y axis corrected', async () => {
    const bitmap = {
      close: vi.fn(),
      height: 3,
      width: 4,
    } as unknown as ImageBitmap;
    const createImageBitmapMock = vi.fn().mockResolvedValue(bitmap);
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('createImageBitmap', createImageBitmapMock);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new Blob(['photo']))));
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn().mockReturnValue('blob:test-photo'),
      revokeObjectURL,
    });

    const loadedTexture = await loadLocalTexture(
      '/demo/photos/micro/memory-001.jpg',
      'micro',
      new AbortController().signal,
    );

    expect(createImageBitmapMock).toHaveBeenCalledWith(expect.any(Blob), {
      imageOrientation: 'flipY',
    });
    expect(loadedTexture.texture.image).toBe(bitmap);

    loadedTexture.texture.dispose();
    loadedTexture.bitmap?.close();
    if (loadedTexture.objectUrl) URL.revokeObjectURL(loadedTexture.objectUrl);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:test-photo');
  });
});

describe('LocalTextureManager', () => {
  it('limits concurrency and gives queued focus work priority', async () => {
    const starts: string[] = [];
    const releases = new Map<string, () => void>();
    const loader: TextureLoader = (key) => {
      starts.push(key);
      return new Promise((resolve) => {
        releases.set(key, () => resolve(loaded()));
      });
    };
    const manager = new LocalTextureManager({ loader, concurrency: 1, byteBudget: 100 });
    const first = manager.acquire('first', 'micro', 0);
    const low = manager.acquire('low', 'micro', 1);
    const focus = manager.acquire('focus', 'preview', 100);

    expect(starts).toEqual(['first']);
    releases.get('first')?.();
    await first;
    await vi.waitFor(() => expect(starts).toEqual(['first', 'focus']));
    releases.get('focus')?.();
    await focus;
    await vi.waitFor(() => expect(starts).toEqual(['first', 'focus', 'low']));
    releases.get('low')?.();
    await low;
    manager.dispose();
  });

  it('retries once and exposes the successful record', async () => {
    let attempts = 0;
    const manager = new LocalTextureManager({
      concurrency: 1,
      retryDelayMs: 0,
      loader: () => {
        attempts += 1;
        if (attempts === 1) return Promise.reject(new Error('temporary'));
        return Promise.resolve(loaded());
      },
    });

    await expect(manager.acquire('retry', 'thumbnail')).resolves.toBeInstanceOf(Texture);
    expect(attempts).toBe(2);
    expect(manager.snapshot()[0]).toMatchObject({ state: 'ready', retryCount: 1 });
    manager.dispose();
  });

  it('evicts the least-recently-used released texture when over budget', async () => {
    const manager = new LocalTextureManager({
      byteBudget: 12,
      loader: () => Promise.resolve(loaded(8)),
    });
    await manager.acquire('old', 'thumbnail');
    manager.release('old', 'thumbnail');
    await manager.acquire('current', 'thumbnail');

    expect(manager.snapshot().map((record) => record.assetKey)).toEqual(['current']);
    expect(manager.byteUsage).toBe(8);
    manager.dispose();
  });
});
