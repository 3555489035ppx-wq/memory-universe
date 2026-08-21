import type { Memory } from '../../domain/memory';
import { isPersonalOpeningHero } from '../../domain/memory';

/**
 * Resolve the one personal opening photo without ever consulting demo data.
 * The optional selection guard prevents a stale marker from pointing outside
 * the current template pool.
 */
export function resolvePersonalOpeningHeroId(
  memories: readonly Memory[],
  selectedIds?: readonly string[],
): string | null {
  const selected = selectedIds ? new Set(selectedIds) : null;
  return memories.find((memory) => (
    isPersonalOpeningHero(memory)
    && (!selected || selected.has(memory.id))
  ))?.id ?? null;
}

/** Keep the chosen opening photo in a sampled template pool. */
export function includeOpeningHeroInSelection(
  memoryIds: readonly string[],
  heroPhotoId: string | null,
  maxPhotos: number,
): string[] {
  const selected = memoryIds.slice(0, maxPhotos);
  if (!heroPhotoId || selected.includes(heroPhotoId)) return selected;
  if (selected.length < maxPhotos) return [...selected, heroPhotoId];
  if (selected.length === 0) return [];
  selected[Math.floor(selected.length / 2)] = heroPhotoId;
  return selected;
}
