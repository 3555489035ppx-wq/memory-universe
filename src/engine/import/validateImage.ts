import {
  ACCEPTED_IMAGE_MIME_TYPES,
  MAX_DECODED_PIXELS,
  MAX_IMPORT_FILE_BYTES,
  MAX_IMPORT_FILES,
} from './importLimits';

export type ImageKind = 'jpeg' | 'png' | 'webp' | 'avif' | 'heic';
export type ImportValidationCode =
  | 'EMPTY_FILE'
  | 'FILE_TOO_LARGE'
  | 'TOO_MANY_FILES'
  | 'UNSUPPORTED_TYPE'
  | 'PIXEL_LIMIT_EXCEEDED'
  | 'INVALID_DIMENSIONS';

export class ImportValidationError extends Error {
  readonly code: ImportValidationCode;

  constructor(code: ImportValidationCode, message: string) {
    super(message);
    this.name = 'ImportValidationError';
    this.code = code;
  }
}

const EXTENSION_TO_KIND: Readonly<Record<string, ImageKind>> = {
  jpg: 'jpeg',
  jpeg: 'jpeg',
  png: 'png',
  webp: 'webp',
  avif: 'avif',
  heic: 'heic',
  heif: 'heic',
};

const MIME_TO_KIND: Readonly<Record<string, ImageKind>> = {
  'image/jpeg': 'jpeg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/heic': 'heic',
  'image/heif': 'heic',
};

function extensionOf(fileName: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(fileName);
  return match?.[1]?.toLocaleLowerCase('en-US') ?? '';
}

export function imageKindFromFile(file: File): ImageKind | null {
  const normalizedMime = file.type.toLocaleLowerCase('en-US');
  return MIME_TO_KIND[normalizedMime] ?? EXTENSION_TO_KIND[extensionOf(file.name)] ?? null;
}

export function isHeicLike(file: File): boolean {
  return imageKindFromFile(file) === 'heic';
}

export function validateBatchSize(fileCount: number): void {
  if (fileCount > MAX_IMPORT_FILES) {
    throw new ImportValidationError(
      'TOO_MANY_FILES',
      `一次最多导入 ${String(MAX_IMPORT_FILES)} 张照片，请分批选择。`,
    );
  }
}

export function validateImage(file: File): ImageKind {
  if (file.size === 0) {
    throw new ImportValidationError('EMPTY_FILE', '文件内容为空，无法读取。');
  }
  if (file.size > MAX_IMPORT_FILE_BYTES) {
    throw new ImportValidationError(
      'FILE_TOO_LARGE',
      `单张照片不能超过 ${String(MAX_IMPORT_FILE_BYTES / 1024 / 1024)} MB。`,
    );
  }
  const kind = imageKindFromFile(file);
  const hasAcceptedMime = ACCEPTED_IMAGE_MIME_TYPES.includes(
    file.type.toLocaleLowerCase('en-US') as (typeof ACCEPTED_IMAGE_MIME_TYPES)[number],
  );
  if (!kind || (file.type && !hasAcceptedMime)) {
    throw new ImportValidationError(
      'UNSUPPORTED_TYPE',
      '当前只支持 JPEG、PNG、WebP、AVIF，以及浏览器能够解码的 HEIC/HEIF。',
    );
  }
  return kind;
}

export function validateDecodedDimensions(width: number, height: number): void {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new ImportValidationError('INVALID_DIMENSIONS', '照片尺寸无效，文件可能已经损坏。');
  }
  if (width * height > MAX_DECODED_PIXELS) {
    throw new ImportValidationError(
      'PIXEL_LIMIT_EXCEEDED',
      `照片解码后超过 ${String(MAX_DECODED_PIXELS / 1_000_000)} 百万像素的安全上限。`,
    );
  }
}
