import type { Memory } from '../../domain/memory';
import type { TemplateTransform } from '../types';

export type TemplateLayoutMap = Record<string, TemplateTransform>;

export function transform(
  position: readonly [number, number, number],
  rotation: readonly [number, number, number] = [0, 0, 0],
  scale = 0.82,
  opacity = 0.9,
): TemplateTransform {
  return { position, rotation, scale, opacity };
}

export function sortedMemories(memories: readonly Memory[]): Memory[] {
  return [...memories].toSorted(
    (left, right) =>
      (left.capturedAtMs ?? Number.MAX_SAFE_INTEGER) -
        (right.capturedAtMs ?? Number.MAX_SAFE_INTEGER) ||
      left.id.localeCompare(right.id),
  );
}

export function dimensions(memory: Memory): readonly [number, number] {
  // Preserve the imported photo ratio across phone portraits, standard
  // landscape images and panoramas. Only pathological metadata is bounded so
  // one corrupt size cannot destabilise a whole layout.
  const aspect = Math.min(4, Math.max(0.25, memory.width / Math.max(1, memory.height)));
  const width = Math.sqrt(aspect);
  return [width, 1 / width];
}

/**
 * Normalises visual area without flattening the source aspect ratio. A wide
 * panorama and a portrait therefore carry similar visual weight while still
 * reading as the photo the user imported.
 */
export function aspectScale(memory: Memory): number {
  const aspect = Math.min(4, Math.max(0.25, memory.width / Math.max(1, memory.height)));
  const extremity = Math.abs(Math.log(aspect));
  return Math.max(0.72, 1 - extremity * 0.15);
}
