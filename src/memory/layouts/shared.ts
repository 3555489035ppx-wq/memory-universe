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
  const aspect = Math.min(1.8, Math.max(0.58, memory.width / Math.max(1, memory.height)));
  return aspect >= 1 ? [aspect, 1] : [1, 1 / aspect];
}
