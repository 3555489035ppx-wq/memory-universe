import pica, { type Pica } from 'pica';

import type { AssetVariant } from '../../data/schema';
import { IMAGE_VARIANTS } from './importLimits';
import { disposeCanvas } from './normalizeOrientation';

export interface DerivedImage {
  variant: Exclude<AssetVariant, 'original'>;
  blob: Blob;
  mime: string;
  width: number;
  height: number;
}

export interface DerivedImageSet {
  images: DerivedImage[];
  microCanvas: HTMLCanvasElement;
  dispose: () => void;
}

export interface DeriveImagesOptions {
  signal?: AbortSignal;
  preserveTransparency?: boolean;
  onVariant?: (
    variant: DerivedImage['variant'],
    completed: number,
    total: number,
  ) => void | Promise<void>;
}

let picaInstance: Pica | null = null;

function getPica(): Pica {
  picaInstance ??= pica({ concurrency: 1 });
  return picaInstance;
}

export function containDimensions(
  width: number,
  height: number,
  longestEdge: number,
): readonly [number, number] {
  const scale = Math.min(1, longestEdge / Math.max(width, height));
  return [Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale))];
}

function createCancellation(signal?: AbortSignal):
  | { promise: Promise<never>; dispose: () => void }
  | undefined {
  if (!signal) return undefined;
  let onAbort: () => void = () => undefined;
  const promise = new Promise<never>((_, reject) => {
    if (signal.aborted) {
      reject(new DOMException('导入已取消。', 'AbortError'));
      return;
    }
    onAbort = () => reject(new DOMException('导入已取消。', 'AbortError'));
    signal.addEventListener('abort', onAbort, { once: true });
  });
  return { promise, dispose: () => signal.removeEventListener('abort', onAbort) };
}

async function encodeCanvas(
  canvas: HTMLCanvasElement,
  quality: number,
  preserveTransparency: boolean,
): Promise<{ blob: Blob; mime: string }> {
  try {
    const webp = await getPica().toBlob(canvas, 'image/webp', quality);
    if (webp.type === 'image/webp') return { blob: webp, mime: 'image/webp' };
  } catch {
    // The explicit fallback below is required for browsers without WebP encoding.
  }
  if (preserveTransparency) {
    const png = await getPica().toBlob(canvas, 'image/png');
    return { blob: png, mime: 'image/png' };
  }
  const jpeg = await getPica().toBlob(canvas, 'image/jpeg', quality);
  return { blob: jpeg, mime: 'image/jpeg' };
}

export async function deriveImages(
  source: HTMLCanvasElement,
  options: DeriveImagesOptions = {},
): Promise<DerivedImageSet> {
  const variants = Object.entries(IMAGE_VARIANTS) as Array<
    [DerivedImage['variant'], (typeof IMAGE_VARIANTS)[keyof typeof IMAGE_VARIANTS]]
  >;
  const images: DerivedImage[] = [];
  const createdCanvases: HTMLCanvasElement[] = [];
  let microCanvas: HTMLCanvasElement | null = null;
  try {
    for (const [variant, specification] of variants) {
      if (options.signal?.aborted) throw new DOMException('导入已取消。', 'AbortError');
      const [width, height] = containDimensions(
        source.width,
        source.height,
        specification.longestEdge,
      );
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      createdCanvases.push(canvas);
      if (width === source.width && height === source.height) {
        const context = canvas.getContext('2d', { alpha: true });
        if (!context) throw new Error('CANVAS_CONTEXT_UNAVAILABLE');
        context.drawImage(source, 0, 0);
      } else {
        const cancellation = createCancellation(options.signal);
        try {
          await getPica().resize(source, canvas, {
            filter: 'mks2013',
            ...(cancellation ? { cancelToken: cancellation.promise } : {}),
          });
        } finally {
          cancellation?.dispose();
        }
      }
      if (options.signal?.aborted) throw new DOMException('导入已取消。', 'AbortError');
      const encoded = await encodeCanvas(
        canvas,
        specification.quality,
        options.preserveTransparency ?? false,
      );
      images.push({ variant, ...encoded, width, height });
      if (variant === 'micro') microCanvas = canvas;
      await options.onVariant?.(variant, images.length, variants.length);
    }
    if (!microCanvas) throw new Error('MICRO_VARIANT_MISSING');
    const retainedMicro = microCanvas;
    return {
      images,
      microCanvas: retainedMicro,
      dispose: () => {
        for (const canvas of createdCanvases) disposeCanvas(canvas);
      },
    };
  } catch (error) {
    for (const canvas of createdCanvases) disposeCanvas(canvas);
    throw error;
  }
}
