import type { MemorySource } from '../../domain/memory';
import type { LayoutPositions, UniverseView } from './layoutTypes';

export const LAYOUT_VERSION = 1;

export function layoutCacheKey(
  source: MemorySource,
  view: UniverseView,
  version = LAYOUT_VERSION,
): string {
  return `${source}:${view}:${String(version)}`;
}

export function cloneLayoutPositions(positions: LayoutPositions): LayoutPositions {
  return Object.fromEntries(
    Object.entries(positions).map(([id, position]) => [id, [...position] as const]),
  );
}
