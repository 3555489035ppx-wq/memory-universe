import { LinearFilter, LinearMipmapLinearFilter, SRGBColorSpace, Texture } from 'three';

import { getAsset } from '../../data/repositories/memoryRepository';

export type TextureVariant = 'micro' | 'thumbnail' | 'preview';
export type TextureState = 'idle' | 'queued' | 'loading' | 'ready' | 'error';

export interface TextureRecord {
  assetKey: string;
  variant: TextureVariant;
  state: TextureState;
  texture?: Texture;
  bitmap?: ImageBitmap;
  objectUrl?: string;
  refCount: number;
  lastUsed: number;
  byteEstimate: number;
  retryCount: number;
}

export interface LoadedTexture {
  texture: Texture;
  bitmap?: ImageBitmap;
  objectUrl?: string;
  byteEstimate: number;
}

export type TextureLoader = (
  assetKey: string,
  variant: TextureVariant,
  signal: AbortSignal,
) => Promise<LoadedTexture>;

interface InternalRecord extends TextureRecord {
  key: string;
  priority: number;
  controller: AbortController;
  resolve: (texture: Texture) => void;
  reject: (error: unknown) => void;
  promise: Promise<Texture>;
}

export interface TextureManagerOptions {
  concurrency?: number;
  byteBudget?: number;
  loader?: TextureLoader;
  retryDelayMs?: number;
}

function gpuByteEstimate(width: number, height: number): number {
  return Math.max(1, Math.round(width * height * 4 * 1.34));
}

async function imageElementFromBlob(
  objectUrl: string,
  signal: AbortSignal,
): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const abort = () => reject(new DOMException('Texture load aborted.', 'AbortError'));
    signal.addEventListener('abort', abort, { once: true });
    image.onload = () => {
      signal.removeEventListener('abort', abort);
      resolve(image);
    };
    image.onerror = () => {
      signal.removeEventListener('abort', abort);
      reject(new Error('TEXTURE_DECODE_FAILED'));
    };
    image.decoding = 'async';
    image.src = objectUrl;
  });
}

export const loadLocalTexture: TextureLoader = async (assetKey, _variant, signal) => {
  let blob: Blob;
  if (assetKey.startsWith('/') || /^https?:\/\//u.test(assetKey)) {
    const response = await fetch(assetKey, { signal, cache: 'force-cache' });
    if (!response.ok) throw new Error(`TEXTURE_HTTP_${String(response.status)}`);
    blob = await response.blob();
  } else {
    const record = await getAsset(assetKey);
    if (!record) throw new Error('TEXTURE_ASSET_MISSING');
    blob = record.blob;
  }
  if (signal.aborted) throw new DOMException('Texture load aborted.', 'AbortError');

  const objectUrl = URL.createObjectURL(blob);
  let bitmap: ImageBitmap | undefined;
  let image: ImageBitmap | HTMLImageElement;
  try {
    if (typeof createImageBitmap === 'function') {
      bitmap = await createImageBitmap(blob, { imageOrientation: 'flipY' });
      image = bitmap;
    } else {
      image = await imageElementFromBlob(objectUrl, signal);
    }
    const texture = new Texture(image);
    texture.colorSpace = SRGBColorSpace;
    texture.generateMipmaps = true;
    texture.minFilter = LinearMipmapLinearFilter;
    texture.magFilter = LinearFilter;
    texture.needsUpdate = true;
    return {
      texture,
      ...(bitmap ? { bitmap } : {}),
      objectUrl,
      byteEstimate: gpuByteEstimate(image.width, image.height),
    };
  } catch (error) {
    bitmap?.close();
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
};

function recordKey(assetKey: string, variant: TextureVariant): string {
  return `${variant}::${assetKey}`;
}

function createInternalRecord(
  assetKey: string,
  variant: TextureVariant,
  priority: number,
): InternalRecord {
  let resolvePromise!: (texture: Texture) => void;
  let rejectPromise!: (error: unknown) => void;
  const promise = new Promise<Texture>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  return {
    key: recordKey(assetKey, variant),
    assetKey,
    variant,
    state: 'queued',
    refCount: 0,
    lastUsed: performance.now(),
    byteEstimate: 0,
    retryCount: 0,
    priority,
    controller: new AbortController(),
    resolve: resolvePromise,
    reject: rejectPromise,
    promise,
  };
}

export class LocalTextureManager {
  readonly #records = new Map<string, InternalRecord>();
  readonly #queue: InternalRecord[] = [];
  readonly #loader: TextureLoader;
  readonly #concurrency: number;
  readonly #retryDelayMs: number;
  #active = 0;
  #byteBudget: number;
  #disposed = false;

  public constructor(options: TextureManagerOptions = {}) {
    this.#loader = options.loader ?? loadLocalTexture;
    this.#concurrency = Math.max(1, options.concurrency ?? 3);
    this.#byteBudget = Math.max(1, options.byteBudget ?? 96 * 1024 * 1024);
    this.#retryDelayMs = Math.max(0, options.retryDelayMs ?? 350);
  }

  public acquire(assetKey: string, variant: TextureVariant, priority = 0): Promise<Texture> {
    if (this.#disposed) return Promise.reject(new Error('TEXTURE_MANAGER_DISPOSED'));
    const key = recordKey(assetKey, variant);
    const existing = this.#records.get(key);
    if (existing) {
      existing.refCount += 1;
      existing.lastUsed = performance.now();
      existing.priority = Math.max(existing.priority, priority);
      if (existing.state === 'ready' && existing.texture) return Promise.resolve(existing.texture);
      if (existing.state === 'error') return Promise.reject(new Error('TEXTURE_LOAD_FAILED'));
      this.#sortQueue();
      return existing.promise;
    }

    const record = createInternalRecord(assetKey, variant, priority);
    record.refCount = 1;
    this.#records.set(key, record);
    this.#queue.push(record);
    this.#sortQueue();
    this.#drain();
    return record.promise;
  }

  public release(assetKey: string, variant: TextureVariant): void {
    const record = this.#records.get(recordKey(assetKey, variant));
    if (!record) return;
    record.refCount = Math.max(0, record.refCount - 1);
    record.lastUsed = performance.now();
    this.#enforceBudget();
  }

  public setByteBudget(byteBudget: number): void {
    this.#byteBudget = Math.max(1, byteBudget);
    this.#enforceBudget();
  }

  public get byteUsage(): number {
    return [...this.#records.values()].reduce(
      (sum, record) => sum + (record.state === 'ready' ? record.byteEstimate : 0),
      0,
    );
  }

  public snapshot(): TextureRecord[] {
    return [...this.#records.values()].map((record) => ({
      assetKey: record.assetKey,
      variant: record.variant,
      state: record.state,
      ...(record.texture ? { texture: record.texture } : {}),
      ...(record.bitmap ? { bitmap: record.bitmap } : {}),
      ...(record.objectUrl ? { objectUrl: record.objectUrl } : {}),
      refCount: record.refCount,
      lastUsed: record.lastUsed,
      byteEstimate: record.byteEstimate,
      retryCount: record.retryCount,
    }));
  }

  public clear(): void {
    for (const record of this.#records.values()) this.#disposeRecord(record);
    this.#records.clear();
    this.#queue.length = 0;
  }

  public dispose(): void {
    this.#disposed = true;
    this.clear();
  }

  #sortQueue(): void {
    this.#queue.sort(
      (left, right) => right.priority - left.priority || left.lastUsed - right.lastUsed,
    );
  }

  #drain(): void {
    while (this.#active < this.#concurrency) {
      const record = this.#queue.shift();
      if (!record || record.state !== 'queued') return;
      this.#active += 1;
      record.state = 'loading';
      void this.#load(record);
    }
  }

  async #load(record: InternalRecord): Promise<void> {
    try {
      const loaded = await this.#loader(record.assetKey, record.variant, record.controller.signal);
      if (record.controller.signal.aborted || this.#disposed) {
        loaded.texture.dispose();
        loaded.bitmap?.close();
        if (loaded.objectUrl) URL.revokeObjectURL(loaded.objectUrl);
        return;
      }
      record.texture = loaded.texture;
      if (loaded.bitmap) record.bitmap = loaded.bitmap;
      if (loaded.objectUrl) record.objectUrl = loaded.objectUrl;
      record.byteEstimate = loaded.byteEstimate;
      record.state = 'ready';
      record.lastUsed = performance.now();
      record.resolve(loaded.texture);
    } catch (error) {
      if (!record.controller.signal.aborted && !this.#disposed && record.retryCount < 1) {
        record.retryCount += 1;
        record.state = 'queued';
        await new Promise((resolve) => setTimeout(resolve, this.#retryDelayMs));
        if (this.#canContinue(record)) {
          this.#queue.push(record);
          this.#sortQueue();
        }
      } else if (!record.controller.signal.aborted) {
        record.state = 'error';
        record.reject(error);
      }
    } finally {
      this.#active = Math.max(0, this.#active - 1);
      this.#enforceBudget();
      this.#drain();
    }
  }

  #enforceBudget(): void {
    let usage = this.byteUsage;
    if (usage <= this.#byteBudget) return;
    const candidates = [...this.#records.values()]
      .filter((record) => record.state === 'ready' && record.refCount === 0)
      .sort((left, right) => left.lastUsed - right.lastUsed);
    for (const record of candidates) {
      usage -= record.byteEstimate;
      this.#disposeRecord(record);
      this.#records.delete(record.key);
      if (usage <= this.#byteBudget) break;
    }
  }

  #canContinue(record: InternalRecord): boolean {
    return !record.controller.signal.aborted && !this.#disposed;
  }

  #disposeRecord(record: InternalRecord): void {
    record.controller.abort();
    record.texture?.dispose();
    record.bitmap?.close();
    if (record.objectUrl) URL.revokeObjectURL(record.objectUrl);
  }
}

export const localTextureManager = new LocalTextureManager();
