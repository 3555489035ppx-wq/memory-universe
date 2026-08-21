import type { Memory } from '../../domain/memory';
import type { Person } from '../../domain/person';
import type { Place } from '../../domain/place';
import type { Relationship } from '../../domain/relationship';

export type Vec3 = readonly [number, number, number];
export type UniverseView = 'time' | 'people' | 'place' | 'emotion';

export interface LayoutInput {
  memories: readonly Memory[];
  relationships: readonly Relationship[];
  viewportSeed: number;
  people?: readonly Person[];
  places?: readonly Place[];
}

export type LayoutPositions = Record<string, Vec3>;

/**
 * Keep a generated spatial layout aligned to the camera's visual axis.
 *
 * Layouts are intentionally allowed to have their own shape and depth. The
 * horizontal visual centroid, however, should not move the whole memory
 * constellation away from the center of the scene when a small personal
 * dataset happens to occupy only one side of the generated path.
 */
export function centerLayoutHorizontally(positions: LayoutPositions): LayoutPositions {
  const entries = Object.entries(positions);
  if (entries.length === 0) return positions;

  const offset = entries.reduce((sum, [, position]) => sum + position[0], 0) / entries.length;
  if (!Number.isFinite(offset) || Math.abs(offset) < Number.EPSILON) return positions;

  return Object.fromEntries(
    entries.map(([id, position]) => [
      id,
      finiteVec3([position[0] - offset, position[1], position[2]]),
    ]),
  );
}

/** Keep the visible memory field balanced on the vertical scene axis too. */
export function centerLayoutVertically(positions: LayoutPositions): LayoutPositions {
  const entries = Object.entries(positions);
  if (entries.length === 0) return positions;

  const offset = entries.reduce((sum, [, position]) => sum + position[1], 0) / entries.length;
  if (!Number.isFinite(offset) || Math.abs(offset) < Number.EPSILON) return positions;

  return Object.fromEntries(
    entries.map(([id, position]) => [
      id,
      finiteVec3([position[0], position[1] - offset, position[2]]),
    ]),
  );
}

export function stableHash(value: string, seed = 0): number {
  let hash = 2_166_136_261 ^ seed;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

export function seededUnit(value: string, seed = 0): number {
  return stableHash(value, seed) / 4_294_967_295;
}

export function finiteVec3(value: Vec3): Vec3 {
  const finite = (coordinate: number) => (Number.isFinite(coordinate) ? coordinate : 0);
  return [finite(value[0]), finite(value[1]), finite(value[2])];
}
