import type { Constellation } from '../../domain/constellation';
import { finiteVec3, seededUnit, type LayoutInput, type LayoutPositions } from './layoutTypes';

export function createConstellationLayout(
  input: LayoutInput,
  constellation: Constellation,
): LayoutPositions {
  const selected = new Set(constellation.memoryIds);
  const memories = input.memories
    .filter((memory) => selected.has(memory.id))
    .toSorted((left, right) => left.id.localeCompare(right.id));
  const positions: LayoutPositions = {};
  memories.forEach((memory, index) => {
    const angle = (index / Math.max(1, memories.length)) * Math.PI * 2;
    const radius = 2.5 + seededUnit(memory.id, input.viewportSeed) * 1.7;
    positions[memory.id] = finiteVec3([
      Math.cos(angle) * radius,
      Math.sin(angle) * radius,
      (seededUnit(memory.id, input.viewportSeed + 4) - 0.5) * 2.4,
    ]);
  });
  return positions;
}
