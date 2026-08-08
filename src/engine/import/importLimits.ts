export const MAX_IMPORT_FILES = 100;
export const MAX_IMPORT_FILE_BYTES = 100 * 1024 * 1024;
export const MAX_DECODED_PIXELS = 80_000_000;
export const METADATA_TIMEOUT_MS = 4_000;

export const IMPORT_CONCURRENCY = {
  standard: 1,
  default: 2,
  highPerformance: 3,
} as const;

export const IMAGE_VARIANTS = {
  preview: { longestEdge: 1600, quality: 0.84 },
  thumbnail: { longestEdge: 512, quality: 0.8 },
  micro: { longestEdge: 64, quality: 0.72 },
} as const;

export const ACCEPTED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/heic',
  'image/heif',
] as const;

export const IMAGE_INPUT_ACCEPT = [
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.avif',
  '.heic',
  '.heif',
  ...ACCEPTED_IMAGE_MIME_TYPES,
].join(',');
