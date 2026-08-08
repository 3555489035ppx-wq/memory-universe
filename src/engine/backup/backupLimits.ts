export const BACKUP_LIMITS = {
  maxZipBytes: 1_000_000_000,
  maxEntries: 10_000,
  maxEntryBytes: 250_000_000,
  maxExpandedBytes: 2_000_000_000,
  chunkBytes: 512 * 1024,
} as const;

const EXECUTABLE_EXTENSIONS = new Set([
  'exe', 'msi', 'bat', 'cmd', 'com', 'scr', 'ps1', 'sh', 'js', 'mjs', 'cjs', 'html', 'svg', 'wasm',
]);

export function validateBackupPath(path: string): string {
  if (!path || path.includes('\\') || path.startsWith('/') || /^[a-z]:/iu.test(path)) {
    throw new Error('BACKUP_PATH_INVALID');
  }
  const segments = path.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    throw new Error('BACKUP_PATH_TRAVERSAL');
  }
  const extension = segments.at(-1)?.split('.').at(-1)?.toLocaleLowerCase('en-US') ?? '';
  if (extension === 'zip') throw new Error('BACKUP_NESTED_ARCHIVE');
  if (EXECUTABLE_EXTENSIONS.has(extension)) throw new Error('BACKUP_EXECUTABLE_REJECTED');

  const rootFiles = new Set([
    'manifest.json',
    'metadata.json',
    'people.json',
    'places.json',
    'constellations.json',
    'settings.json',
  ]);
  const isAsset =
    segments.length === 3 &&
    segments[0] === 'assets' &&
    ['micro', 'thumbnails', 'previews', 'originals'].includes(segments[1] ?? '') &&
    ['jpg', 'jpeg', 'png', 'webp', 'avif'].includes(extension);
  if (!rootFiles.has(path) && !isAsset) throw new Error('BACKUP_PATH_UNKNOWN');
  return path;
}
