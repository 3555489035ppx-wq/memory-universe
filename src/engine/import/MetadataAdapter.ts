import type { ExpandedTags, load as loadExifMetadata } from 'exifreader';

import type { DateSource } from '../../domain/memory';
import { METADATA_TIMEOUT_MS } from './importLimits';

export interface NormalizedMetadata {
  capturedAt: string | null;
  capturedAtMs: number | null;
  dateSource: DateSource;
  orientation: number | null;
  latitude: number | null;
  longitude: number | null;
  cameraModel: string | null;
}

export type MetadataWarningCode = 'METADATA_MISSING' | 'METADATA_TIMEOUT' | 'METADATA_INVALID';

export interface MetadataWarning {
  code: MetadataWarningCode;
  message: string;
}

export interface MetadataAdapterOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  loader?: (file: File) => Promise<ExpandedTags>;
  onWarning?: (warning: MetadataWarning) => void;
}

interface TagLike {
  value?: unknown;
  computed?: unknown;
  description?: unknown;
}

class MetadataTimeoutError extends Error {
  constructor() {
    super('METADATA_TIMEOUT');
    this.name = 'MetadataTimeoutError';
  }
}

function abortError(): DOMException {
  return new DOMException('导入已取消。', 'AbortError');
}

async function defaultMetadataLoader(file: File): Promise<ExpandedTags> {
  const [module, buffer] = await Promise.all([import('exifreader'), file.arrayBuffer()]);
  type ExifLoad = typeof loadExifMetadata;
  const compatibleModule = module as unknown as {
    load?: ExifLoad;
    default?: { load?: ExifLoad };
  };
  const loadMetadata = compatibleModule.load ?? compatibleModule.default?.load;
  if (!loadMetadata) throw new Error('EXIF_READER_UNAVAILABLE');
  return loadMetadata(buffer, {
    expanded: true,
    async: true,
    includeTags: {
      exif: [
        'DateTimeOriginal',
        'DateTimeDigitized',
        'DateTime',
        'OffsetTimeOriginal',
        'OffsetTimeDigitized',
        'OffsetTime',
        'Orientation',
        'GPSLatitude',
        'GPSLongitude',
        'GPSLatitudeRef',
        'GPSLongitudeRef',
        'Model',
      ],
      gps: true,
    },
  });
}

function tagText(tag: unknown): string | null {
  if (!tag || typeof tag !== 'object') return null;
  const candidate = tag as TagLike;
  const values = [candidate.computed, candidate.description, candidate.value];
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (Array.isArray(value)) {
      const first = value.find((entry): entry is string => typeof entry === 'string' && !!entry.trim());
      if (first) return first.trim();
    }
  }
  return null;
}

function tagNumber(tag: unknown): number | null {
  if (!tag || typeof tag !== 'object') return null;
  const value = (tag as TagLike).value;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function localDateString(date: Date): string {
  return `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

interface NormalizedDate {
  capturedAt: string;
  capturedAtMs: number;
}

export function normalizeExifDate(rawDate: string, rawOffset: string | null = null): NormalizedDate | null {
  const match = /^(\d{4})[:/-](\d{2})[:/-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:\s*(Z|[+-]\d{2}:?\d{2}))?$/.exec(
    rawDate.trim(),
  );
  if (!match) return null;
  const values = match.slice(1, 7).map(Number);
  const [year, month, day, hours, minutes, seconds] = values;
  if (
    year === undefined ||
    month === undefined ||
    day === undefined ||
    hours === undefined ||
    minutes === undefined ||
    seconds === undefined
  ) {
    return null;
  }
  const localBase = `${String(year).padStart(4, '0')}-${pad(month)}-${pad(day)}T${pad(hours)}:${pad(
    minutes,
  )}:${pad(seconds)}`;
  const suppliedOffset = match[7] ?? rawOffset?.trim() ?? '';
  const normalizedOffset = suppliedOffset && suppliedOffset !== 'Z'
    ? suppliedOffset.includes(':')
      ? suppliedOffset
      : `${suppliedOffset.slice(0, 3)}:${suppliedOffset.slice(3)}`
    : suppliedOffset;
  const capturedAt = `${localBase}${normalizedOffset}`;
  const capturedAtMs = normalizedOffset
    ? Date.parse(capturedAt)
    : new Date(year, month - 1, day, hours, minutes, seconds).getTime();
  if (!Number.isFinite(capturedAtMs)) return null;
  if (!normalizedOffset) {
    const verify = new Date(capturedAtMs);
    if (
      verify.getFullYear() !== year ||
      verify.getMonth() !== month - 1 ||
      verify.getDate() !== day ||
      verify.getHours() !== hours ||
      verify.getMinutes() !== minutes ||
      verify.getSeconds() !== seconds
    ) {
      return null;
    }
  }
  return { capturedAt, capturedAtMs };
}

function fallbackDate(file: File): Pick<NormalizedMetadata, 'capturedAt' | 'capturedAtMs' | 'dateSource'> {
  if (!Number.isFinite(file.lastModified) || file.lastModified <= 0) {
    return { capturedAt: null, capturedAtMs: null, dateSource: 'unknown' };
  }
  const date = new Date(file.lastModified);
  return {
    capturedAt: localDateString(date),
    capturedAtMs: file.lastModified,
    dateSource: 'file',
  };
}

function normalizeCoordinate(value: number | undefined, minimum: number, maximum: number): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum
    ? value
    : null;
}

function normalizeTags(tags: ExpandedTags, file: File): NormalizedMetadata {
  const exif = tags.exif;
  const dateCandidates = [
    [exif?.DateTimeOriginal, exif?.OffsetTimeOriginal],
    [exif?.DateTimeDigitized, exif?.OffsetTimeDigitized],
    [exif?.DateTime, exif?.OffsetTime],
  ] as const;
  let normalizedDate: NormalizedDate | null = null;
  for (const [dateTag, offsetTag] of dateCandidates) {
    const dateText = tagText(dateTag);
    if (!dateText) continue;
    normalizedDate = normalizeExifDate(dateText, tagText(offsetTag));
    if (normalizedDate) break;
  }
  const fallback = fallbackDate(file);
  const rawOrientation = tagNumber(exif?.Orientation);
  const orientation =
    rawOrientation !== null && Number.isInteger(rawOrientation) && rawOrientation >= 1 && rawOrientation <= 8
      ? rawOrientation
      : null;

  return {
    capturedAt: normalizedDate?.capturedAt ?? fallback.capturedAt,
    capturedAtMs: normalizedDate?.capturedAtMs ?? fallback.capturedAtMs,
    dateSource: normalizedDate ? 'exif' : fallback.dateSource,
    orientation,
    latitude: normalizeCoordinate(tags.gps?.Latitude, -90, 90),
    longitude: normalizeCoordinate(tags.gps?.Longitude, -180, 180),
    cameraModel: tagText(exif?.Model),
  };
}

function raceMetadata(
  task: Promise<ExpandedTags>,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<ExpandedTags> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    let settled = false;
    const cleanup = () => {
      window.clearTimeout(timeout);
      signal?.removeEventListener('abort', onAbort);
    };
    const resolveOnce = (value: ExpandedTags) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };
    const rejectOnce = (error: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error instanceof Error ? error : new Error(String(error)));
    };
    const timeout = window.setTimeout(() => rejectOnce(new MetadataTimeoutError()), timeoutMs);
    const onAbort = () => rejectOnce(abortError());
    signal?.addEventListener('abort', onAbort, { once: true });
    void task.then(resolveOnce, rejectOnce);
  });
}

export async function readMetadata(
  file: File,
  options: MetadataAdapterOptions = {},
): Promise<NormalizedMetadata> {
  const loader = options.loader ?? defaultMetadataLoader;
  try {
    const tags = await raceMetadata(
      loader(file),
      options.timeoutMs ?? METADATA_TIMEOUT_MS,
      options.signal,
    );
    const metadata = normalizeTags(tags, file);
    if (!tags.exif) {
      options.onWarning?.({
        code: 'METADATA_MISSING',
        message: '未找到可用的 EXIF 信息，已使用文件日期；人物、地点和情绪可稍后补充。',
      });
    }
    return metadata;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    options.onWarning?.(
      error instanceof MetadataTimeoutError
        ? { code: 'METADATA_TIMEOUT', message: '元数据读取超时，已跳过 EXIF 并继续导入。' }
        : { code: 'METADATA_INVALID', message: '元数据无法读取，已跳过 EXIF 并继续导入。' },
    );
    const fallback = fallbackDate(file);
    return {
      ...fallback,
      orientation: null,
      latitude: null,
      longitude: null,
      cameraModel: null,
    };
  }
}
