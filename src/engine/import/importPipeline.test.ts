import { describe, expect, it, vi } from 'vitest';

import type { DominantColor } from '../../domain/memory';
import type { StorageQuotaSnapshot } from '../../data/quota';
import type { DerivedImageSet, DeriveImagesOptions } from './deriveImages';
import {
  runImportBatch,
  type ImportPipelineDependencies,
  type ImportProgress,
  type ImportRequest,
} from './importPipeline';
import type { NormalizedMetadata } from './MetadataAdapter';
import { ImageDecodeError, type DecodedImage } from './normalizeOrientation';

const metadata: NormalizedMetadata = {
  capturedAt: '2024-08-03T14:25:10',
  capturedAtMs: new Date(2024, 7, 3, 14, 25, 10).getTime(),
  dateSource: 'exif',
  orientation: 6,
  latitude: 31.2304,
  longitude: 121.4737,
  cameraModel: 'Fixture Camera',
};

const dominantColor: DominantColor = {
  rgb: [80, 90, 100],
  hsl: [210, 11.1, 35.3],
  luminance: 0.098,
  algorithmVersion: 1,
};

function request(id: string, name = `${id}.jpg`): ImportRequest {
  return {
    id,
    file: new File([new Uint8Array([1, 2, 3])], name, {
      type: 'image/jpeg',
      lastModified: 1000,
    }),
  };
}

function decodedImage(close = vi.fn()): DecodedImage {
  return {
    bitmap: { width: 1200, height: 800, close } as unknown as ImageBitmap,
    orientationApplied: true,
  };
}

async function derived(options?: DeriveImagesOptions): Promise<DerivedImageSet> {
  const specifications = [
    ['preview', 1200, 800],
    ['thumbnail', 512, 341],
    ['micro', 64, 43],
  ] as const;
  for (let index = 0; index < specifications.length; index += 1) {
    const specification = specifications[index];
    if (specification) {
      await options?.onVariant?.(specification[0], index + 1, specifications.length);
    }
  }
  const microCanvas = document.createElement('canvas');
  microCanvas.width = 64;
  microCanvas.height = 43;
  return {
    images: specifications.map(([variant, width, height]) => ({
      variant,
      blob: new Blob([variant], { type: 'image/webp' }),
      mime: 'image/webp',
      width,
      height,
    })),
    microCanvas,
    dispose: vi.fn(),
  };
}

function dependencies(
  overrides: Partial<ImportPipelineDependencies> = {},
): Partial<ImportPipelineDependencies> {
  return {
    readMetadata: vi.fn<ImportPipelineDependencies['readMetadata']>(() => Promise.resolve(metadata)),
    decodeImage: vi.fn<ImportPipelineDependencies['decodeImage']>(() =>
      Promise.resolve(decodedImage()),
    ),
    normalizeOrientation: vi.fn<ImportPipelineDependencies['normalizeOrientation']>(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 800;
      return canvas;
    }),
    deriveImages: vi.fn<ImportPipelineDependencies['deriveImages']>((canvas, options) => {
      void canvas;
      return derived(options);
    }),
    extractDominantColor: vi.fn<ImportPipelineDependencies['extractDominantColor']>(
      () => dominantColor,
    ),
    readStorageQuota: vi.fn<ImportPipelineDependencies['readStorageQuota']>(
      (): Promise<StorageQuotaSnapshot | null> => Promise.resolve(null),
    ),
    saveMemoryBundle: vi.fn<ImportPipelineDependencies['saveMemoryBundle']>(() => Promise.resolve()),
    saveImportJob: vi.fn<ImportPipelineDependencies['saveImportJob']>(() => Promise.resolve()),
    checksum: vi.fn<ImportPipelineDependencies['checksum']>((blob: Blob) =>
      Promise.resolve(`checksum-${String(blob.size)}`),
    ),
    now: () => new Date('2026-08-04T00:00:00.000Z'),
    randomUUID: () => 'memory-uuid',
    ...overrides,
  };
}

describe('runImportBatch', () => {
  it('reports real stages and builds the three-asset personal memory bundle', async () => {
    const progress: ImportProgress[] = [];
    const save = vi.fn<ImportPipelineDependencies['saveMemoryBundle']>(() => Promise.resolve());
    const result = await runImportBatch([request('request-1', '海边清晨.jpg')], {
      concurrency: 1,
      onProgress: (update) => progress.push(update),
      dependencies: dependencies({ saveMemoryBundle: save }),
    });

    expect(result.successCount).toBe(1);
    expect(progress.map((update) => update.stage)).toEqual([
      'queued',
      'metadata',
      'decoding',
      'orientation',
      'preview',
      'thumbnail',
      'micro',
      'color',
      'saving',
      'done',
    ]);
    const [memory, assets, options] = save.mock.calls[0] ?? [];
    expect(memory).toEqual(
      expect.objectContaining({
        id: 'personal-memory-uuid',
        source: 'personal',
        title: '海边清晨',
        placeId: 'personal-place-personal-memory-uuid',
        orientationApplied: true,
      }),
    );
    expect(assets).toHaveLength(3);
    expect(options).toEqual(
      expect.objectContaining({
        place: expect.objectContaining({ latitude: 31.2304, longitude: 121.4737 }),
      }),
    );
  });

  it('continues after a per-file decode failure and returns a truthful batch summary', async () => {
    const decode = vi.fn<ImportPipelineDependencies['decodeImage']>((file: File) => {
      if (file.name.startsWith('bad')) {
        return Promise.reject(new ImageDecodeError('IMAGE_DECODE_FAILED', '损坏'));
      }
      return Promise.resolve(decodedImage());
    });
    const result = await runImportBatch(
      [request('bad-request', 'bad.jpg'), request('good-request', 'good.jpg')],
      { concurrency: 2, dependencies: dependencies({ decodeImage: decode }) },
    );

    expect(result.successCount).toBe(1);
    expect(result.failureCount).toBe(1);
    expect(result.results.find((item) => item.requestId === 'bad-request')).toEqual(
      expect.objectContaining({
        status: 'failed',
        error: expect.objectContaining({ code: 'IMAGE_DECODE_FAILED' }),
      }),
    );
  });

  it('does not write a request cancelled before processing', async () => {
    const controller = new AbortController();
    controller.abort();
    const save = vi.fn<ImportPipelineDependencies['saveMemoryBundle']>(() => Promise.resolve());
    const result = await runImportBatch([request('cancelled')], {
      signal: controller.signal,
      dependencies: dependencies({ saveMemoryBundle: save }),
    });

    expect(result.cancelledCount).toBe(1);
    expect(save).not.toHaveBeenCalled();
  });

  it('turns an insufficient quota estimate into a specific local-storage failure', async () => {
    const result = await runImportBatch([request('quota')], {
      dependencies: dependencies({
        readStorageQuota: vi.fn<ImportPipelineDependencies['readStorageQuota']>(() =>
          Promise.resolve({
            usage: 100,
            quota: 100,
            remaining: 0,
            usageRatio: 1,
            persisted: false,
          }),
        ),
      }),
    });

    expect(result.results[0]).toEqual(
      expect.objectContaining({
        status: 'failed',
        error: expect.objectContaining({ code: 'STORAGE_QUOTA_EXCEEDED' }),
      }),
    );
  });
});
