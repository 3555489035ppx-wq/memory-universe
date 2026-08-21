import type { Memory } from '../../domain/memory';

/** Keep the full timeline represented without duplicating a real photograph. */
export function selectTemplateMemoryIds(
  memories: readonly Memory[],
  maxPhotos: number,
): string[] {
  const chronological = memories
    .toSorted((left, right) => {
      const leftTime = left.capturedAtMs ?? Number.MAX_SAFE_INTEGER;
      const rightTime = right.capturedAtMs ?? Number.MAX_SAFE_INTEGER;
      return leftTime - rightTime || left.id.localeCompare(right.id);
    });
  if (chronological.length <= maxPhotos) return chronological.map((memory) => memory.id);
  return Array.from({ length: maxPhotos }, (_, index) => {
    const sourceIndex = Math.round((index * (chronological.length - 1)) / (maxPhotos - 1));
    return chronological[sourceIndex]?.id ?? chronological.at(-1)?.id ?? '';
  }).filter(Boolean);
}
