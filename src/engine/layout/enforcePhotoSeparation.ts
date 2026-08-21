import type { Memory } from '../../domain/memory';
import { finiteVec3, type LayoutPositions } from './layoutTypes';

export interface PhotoFootprint {
  width: number;
  height: number;
}

export interface SeparationOptions {
  scale?: number;
  gap?: number;
  depthThreshold?: number;
  iterations?: number;
}

export function photoFootprint(memory: Memory, scale = 0.68): PhotoFootprint {
  const rawAspect = memory.width / Math.max(1, memory.height);
  const aspect = Math.min(1.8, Math.max(0.58, rawAspect));
  return aspect >= 1
    ? { width: aspect * scale, height: scale }
    : { width: scale, height: (1 / aspect) * scale };
}

export function enforcePhotoSeparation(
  positions: LayoutPositions,
  memories: readonly Memory[],
  options: SeparationOptions = {},
): LayoutPositions {
  const scale = options.scale ?? 0.68;
  const gap = options.gap ?? 0.12;
  const depthThreshold = options.depthThreshold ?? 1.6;
  const iterations = options.iterations ?? 8;
  const ordered = memories
    .filter((memory) => positions[memory.id] !== undefined)
    .toSorted((left, right) => left.id.localeCompare(right.id));
  const mutable = Object.fromEntries(
    Object.entries(positions).map(([id, position]) => [id, [...position] as [number, number, number]]),
  );
  const footprints = new Map(ordered.map((memory) => [memory.id, photoFootprint(memory, scale)]));

  for (let pass = 0; pass < iterations; pass += 1) {
    let changed = false;
    for (let leftIndex = 0; leftIndex < ordered.length; leftIndex += 1) {
      const left = ordered[leftIndex];
      if (!left) continue;
      const leftPosition = mutable[left.id];
      const leftFootprint = footprints.get(left.id);
      if (!leftPosition || !leftFootprint) continue;
      for (let rightIndex = leftIndex + 1; rightIndex < ordered.length; rightIndex += 1) {
        const right = ordered[rightIndex];
        if (!right) continue;
        const rightPosition = mutable[right.id];
        const rightFootprint = footprints.get(right.id);
        if (!rightPosition || !rightFootprint) continue;
        if (Math.abs(leftPosition[2] - rightPosition[2]) > depthThreshold) continue;

        const deltaX = rightPosition[0] - leftPosition[0];
        const deltaY = rightPosition[1] - leftPosition[1];
        const requiredX = (leftFootprint.width + rightFootprint.width) / 2 + gap;
        const requiredY = (leftFootprint.height + rightFootprint.height) / 2 + gap;
        const overlapX = requiredX - Math.abs(deltaX);
        const overlapY = requiredY - Math.abs(deltaY);
        if (overlapX <= 0 || overlapY <= 0) continue;

        changed = true;
        if (overlapX <= overlapY) {
          const direction = deltaX === 0 ? (left.id < right.id ? 1 : -1) : Math.sign(deltaX);
          const correction = (overlapX + 0.001) / 2;
          leftPosition[0] -= direction * correction;
          rightPosition[0] += direction * correction;
        } else {
          const direction = deltaY === 0 ? (left.id < right.id ? 1 : -1) : Math.sign(deltaY);
          const correction = (overlapY + 0.001) / 2;
          leftPosition[1] -= direction * correction;
          rightPosition[1] += direction * correction;
        }
      }
    }
    if (!changed) break;
  }

  return Object.fromEntries(
    Object.entries(mutable).map(([id, position]) => [id, finiteVec3(position)]),
  );
}
