import type { Memory } from '../../domain/memory';
import type { Place } from '../../domain/place';
import type { AssetRecord, ImportJobRecord, ImportJobStage } from '../../data/schema';
import { readStorageQuota } from '../../data/quota';
import { saveImportJob } from '../../data/repositories/importJobRepository';
import { saveMemoryBundle } from '../../data/repositories/memoryRepository';
import { deriveImages, type DerivedImageSet } from './deriveImages';
import { extractDominantColor } from './extractDominantColor';
import { IMPORT_CONCURRENCY } from './importLimits';
import { readMetadata, type MetadataWarning, type NormalizedMetadata } from './MetadataAdapter';
import {
  decodeImage,
  type DecodedImage,
  disposeCanvas,
  ImageDecodeError,
  normalizeOrientation,
} from './normalizeOrientation';
import {
  imageKindFromFile,
  ImportValidationError,
  validateBatchSize,
  validateImage,
} from './validateImage';

export type ImportProgressStage =
  | 'queued'
  | 'metadata'
  | 'decoding'
  | 'orientation'
  | 'preview'
  | 'thumbnail'
  | 'micro'
  | 'color'
  | 'saving'
  | 'done'
  | 'failed'
  | 'cancelled';

export interface ImportRequest {
  id: string;
  file: File;
}

export interface ImportProgress {
  requestId: string;
  fileName: string;
  stage: ImportProgressStage;
  progress: number;
  message: string;
}

export interface ImportErrorDetail {
  code: string;
  message: string;
}

export interface ImportSuccess {
  status: 'done';
  requestId: string;
  fileName: string;
  memory: Memory;
  warnings: MetadataWarning[];
}

export interface ImportFailure {
  status: 'failed' | 'cancelled';
  requestId: string;
  fileName: string;
  error: ImportErrorDetail;
  warnings: MetadataWarning[];
}

export type ImportResult = ImportSuccess | ImportFailure;

export interface ImportBatchResult {
  results: ImportResult[];
  successCount: number;
  failureCount: number;
  cancelledCount: number;
}

export interface ImportPipelineOptions {
  signal?: AbortSignal;
  concurrency?: number;
  onProgress?: (progress: ImportProgress) => void;
  dependencies?: Partial<ImportPipelineDependencies>;
}

interface SaveBundleOptions {
  place?: Place;
  signal?: AbortSignal;
}

export interface ImportPipelineDependencies {
  readMetadata: typeof readMetadata;
  decodeImage: typeof decodeImage;
  normalizeOrientation: typeof normalizeOrientation;
  deriveImages: typeof deriveImages;
  extractDominantColor: typeof extractDominantColor;
  readStorageQuota: typeof readStorageQuota;
  saveMemoryBundle: (
    memory: Memory,
    assets: readonly AssetRecord[],
    options?: SaveBundleOptions,
  ) => Promise<void>;
  saveImportJob: (job: ImportJobRecord) => Promise<void>;
  checksum: (blob: Blob) => Promise<string>;
  now: () => Date;
  randomUUID: () => string;
}

const STAGE_DETAILS: Readonly<
  Record<ImportProgressStage, { progress: number; message: string; jobStage: ImportJobStage }>
> = {
  queued: { progress: 0, message: '等待处理', jobStage: 'queued' },
  metadata: { progress: 0.08, message: '读取照片信息', jobStage: 'parsing' },
  decoding: { progress: 0.2, message: '解码照片', jobStage: 'parsing' },
  orientation: { progress: 0.32, message: '校正照片方向', jobStage: 'resizing' },
  preview: { progress: 0.5, message: '生成预览图', jobStage: 'resizing' },
  thumbnail: { progress: 0.65, message: '生成缩略图', jobStage: 'resizing' },
  micro: { progress: 0.78, message: '生成空间节点图', jobStage: 'resizing' },
  color: { progress: 0.86, message: '提取照片主色', jobStage: 'extracting' },
  saving: { progress: 0.94, message: '保存到当前浏览器', jobStage: 'saving' },
  done: { progress: 1, message: '已完成', jobStage: 'done' },
  failed: { progress: 1, message: '导入失败', jobStage: 'failed' },
  cancelled: { progress: 1, message: '已取消', jobStage: 'cancelled' },
};

function defaultDependencies(): ImportPipelineDependencies {
  return {
    readMetadata,
    decodeImage,
    normalizeOrientation,
    deriveImages,
    extractDominantColor,
    readStorageQuota,
    saveMemoryBundle,
    saveImportJob,
    checksum: checksumBlob,
    now: () => new Date(),
    randomUUID: () => crypto.randomUUID(),
  };
}

function resolveDependencies(
  overrides: Partial<ImportPipelineDependencies> | undefined,
): ImportPipelineDependencies {
  return { ...defaultDependencies(), ...overrides };
}

export function createImportRequests(files: readonly File[]): ImportRequest[] {
  validateBatchSize(files.length);
  return files.map((file) => ({ id: `import-${crypto.randomUUID()}`, file }));
}

export function resolveImportConcurrency(): number {
  const hardwareConcurrencyValue = (navigator as unknown as { hardwareConcurrency?: number })
    .hardwareConcurrency;
  const hardwareConcurrency = Math.max(
    1,
    typeof hardwareConcurrencyValue === 'number' && Number.isFinite(hardwareConcurrencyValue)
      ? hardwareConcurrencyValue
      : 1,
  );
  if (hardwareConcurrency <= 4) {
    return IMPORT_CONCURRENCY.standard;
  }
  const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 0;
  return hardwareConcurrency >= 8 && deviceMemory >= 8
    ? IMPORT_CONCURRENCY.highPerformance
    : IMPORT_CONCURRENCY.default;
}

async function checksumBlob(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function titleFromFileName(fileName: string): string {
  const title = fileName.replace(/\.[^.]+$/, '').trim();
  return (title || '未命名记忆').slice(0, 120);
}

function createPlace(
  metadata: NormalizedMetadata,
  memoryId: string,
  now: string,
): Place | undefined {
  if (metadata.latitude === null || metadata.longitude === null) return undefined;
  return {
    id: `personal-place-${memoryId}`,
    source: 'personal',
    name: `照片位置 · ${metadata.latitude.toFixed(3)}, ${metadata.longitude.toFixed(3)}`,
    latitude: metadata.latitude,
    longitude: metadata.longitude,
    createdAt: now,
    updatedAt: now,
  };
}

function asAssetRecords(
  derived: DerivedImageSet,
  memoryId: string,
  createdAt: string,
  checksums: readonly string[],
): AssetRecord[] {
  return derived.images.map((image, index) => ({
    key: `personal:${memoryId}:${image.variant}`,
    memoryId,
    source: 'personal',
    variant: image.variant,
    blob: image.blob,
    mime: image.mime,
    width: image.width,
    height: image.height,
    checksum: checksums[index] ?? '',
    byteLength: image.blob.size,
    createdAt,
  }));
}

function createMemory(
  request: ImportRequest,
  metadata: NormalizedMetadata,
  derived: DerivedImageSet,
  place: Place | undefined,
  dominantColor: Memory['dominantColor'],
  now: string,
  memoryId: string,
): Memory {
  const imageByVariant = new Map(derived.images.map((image) => [image.variant, image]));
  const preview = imageByVariant.get('preview');
  if (!preview) throw new Error('PREVIEW_VARIANT_MISSING');
  return {
    id: memoryId,
    source: 'personal',
    title: titleFromFileName(request.file.name),
    description: '',
    capturedAt: metadata.capturedAt,
    capturedAtMs: metadata.capturedAtMs,
    dateSource: metadata.dateSource,
    personIds: [],
    placeId: place?.id ?? null,
    mood: null,
    tags: [],
    dominantColor,
    assetKeys: {
      micro: `personal:${memoryId}:micro`,
      thumbnail: `personal:${memoryId}:thumbnail`,
      preview: `personal:${memoryId}:preview`,
    },
    width: preview.width,
    height: preview.height,
    orientationApplied: true,
    ...(metadata.cameraModel ? { cameraModel: metadata.cameraModel } : {}),
    createdAt: now,
    updatedAt: now,
    schemaVersion: 1,
  };
}

function normalizeError(error: unknown): ImportErrorDetail {
  if (error instanceof ImportValidationError || error instanceof ImageDecodeError) {
    return { code: error.code, message: error.message };
  }
  if (error instanceof DOMException && error.name === 'AbortError') {
    return { code: 'CANCELLED', message: '导入已取消，未完成的照片没有写入本地数据库。' };
  }
  if (
    error instanceof DOMException &&
    (error.name === 'QuotaExceededError' || error.name === 'UnknownError')
  ) {
    return {
      code: 'STORAGE_QUOTA_EXCEEDED',
      message: '当前浏览器可用存储空间不足。请减少照片数量，或在设置中导出后清理本地数据。',
    };
  }
  return {
    code: 'IMPORT_FAILED',
    message: '这张照片未能完成导入。其他照片会继续处理，你可以稍后重试。',
  };
}

async function processRequest(
  request: ImportRequest,
  options: ImportPipelineOptions,
  dependencies: ImportPipelineDependencies,
): Promise<ImportResult> {
  const warnings: MetadataWarning[] = [];
  let decoded: DecodedImage | null = null;
  let normalizedCanvas: HTMLCanvasElement | null = null;
  let derived: DerivedImageSet | null = null;
  const startedAt = dependencies.now().toISOString();
  const report = async (stage: ImportProgressStage, errorCode?: string): Promise<void> => {
    const detail = STAGE_DETAILS[stage];
    const timestamp = dependencies.now().toISOString();
    options.onProgress?.({
      requestId: request.id,
      fileName: request.file.name,
      stage,
      progress: detail.progress,
      message: detail.message,
    });
    try {
      await dependencies.saveImportJob({
        id: request.id,
        fileName: request.file.name,
        stage: detail.jobStage,
        progress: detail.progress,
        ...(errorCode ? { errorCode } : {}),
        createdAt: startedAt,
        updatedAt: timestamp,
      });
    } catch {
      // Job history is diagnostic; the atomic memory write remains authoritative.
    }
  };

  try {
    await report('queued');
    validateImage(request.file);
    if (options.signal?.aborted) throw new DOMException('导入已取消。', 'AbortError');
    await report('metadata');
    const metadata = await dependencies.readMetadata(request.file, {
      ...(options.signal ? { signal: options.signal } : {}),
      onWarning: (warning) => warnings.push(warning),
    });
    await report('decoding');
    decoded = await dependencies.decodeImage(request.file, options.signal);
    await report('orientation');
    normalizedCanvas = dependencies.normalizeOrientation(
      decoded.bitmap,
      decoded.orientationApplied ? null : metadata.orientation,
    );
    const kind = imageKindFromFile(request.file);
    derived = await dependencies.deriveImages(normalizedCanvas, {
      ...(options.signal ? { signal: options.signal } : {}),
      preserveTransparency: kind === 'png',
      onVariant: (variant) => report(variant),
    });
    await report('color');
    const dominantColor = dependencies.extractDominantColor(derived.microCanvas);
    const checksums = await Promise.all(
      derived.images.map((image) => dependencies.checksum(image.blob)),
    );
    const quota = await dependencies.readStorageQuota();
    const requiredBytes = derived.images.reduce((sum, image) => sum + image.blob.size, 0);
    if (quota && quota.remaining < requiredBytes) {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError');
    }
    const timestamp = dependencies.now().toISOString();
    const memoryId = `personal-${dependencies.randomUUID()}`;
    const place = createPlace(metadata, memoryId, timestamp);
    const memory = createMemory(
      request,
      metadata,
      derived,
      place,
      dominantColor,
      timestamp,
      memoryId,
    );
    const assets = asAssetRecords(derived, memoryId, timestamp, checksums);
    await report('saving');
    await dependencies.saveMemoryBundle(memory, assets, {
      ...(place ? { place } : {}),
      ...(options.signal ? { signal: options.signal } : {}),
    });
    await report('done');
    return { status: 'done', requestId: request.id, fileName: request.file.name, memory, warnings };
  } catch (error) {
    const detail = normalizeError(error);
    const status = detail.code === 'CANCELLED' ? 'cancelled' : 'failed';
    await report(status, detail.code);
    return {
      status,
      requestId: request.id,
      fileName: request.file.name,
      error: detail,
      warnings,
    };
  } finally {
    derived?.dispose();
    if (normalizedCanvas) disposeCanvas(normalizedCanvas);
    decoded?.bitmap.close();
  }
}

export async function runImportBatch(
  requests: readonly ImportRequest[],
  options: ImportPipelineOptions = {},
): Promise<ImportBatchResult> {
  validateBatchSize(requests.length);
  const dependencies = resolveDependencies(options.dependencies);
  const concurrency = Math.max(
    1,
    Math.min(IMPORT_CONCURRENCY.highPerformance, options.concurrency ?? resolveImportConcurrency()),
  );
  const results: Array<ImportResult | undefined> = Array.from(
    { length: requests.length },
    () => undefined,
  );
  let nextIndex = 0;

  const worker = async () => {
    while (nextIndex < requests.length) {
      const index = nextIndex;
      nextIndex += 1;
      const request = requests[index];
      if (!request) continue;
      results[index] = await processRequest(request, options, dependencies);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, requests.length) }, async () => worker()),
  );
  const completed = results.filter((result): result is ImportResult => result !== undefined);
  return {
    results: completed,
    successCount: completed.filter((result) => result.status === 'done').length,
    failureCount: completed.filter((result) => result.status === 'failed').length,
    cancelledCount: completed.filter((result) => result.status === 'cancelled').length,
  };
}
