import type { Memory } from '../../domain/memory';
import { finiteVec3, seededUnit, type LayoutInput, type LayoutPositions } from './layoutTypes';

function timestamp(memory: Memory, fallback: number): number {
  return memory.capturedAtMs ?? fallback;
}

export function createTimeLayout(input: LayoutInput): LayoutPositions {
  const dated = input.memories
    .filter((memory) => memory.capturedAtMs !== null)
    .toSorted(
      (left, right) =>
        timestamp(left, 0) - timestamp(right, 0) || left.id.localeCompare(right.id),
    );
  const missing = input.memories
    .filter((memory) => memory.capturedAtMs === null)
    .toSorted((left, right) => left.id.localeCompare(right.id));
  const earliest = dated[0]?.capturedAtMs ?? 0;
  const latest = dated.at(-1)?.capturedAtMs ?? earliest + 1;
  const span = Math.max(1, latest - earliest);
  const positions: LayoutPositions = {};

  for (const memory of dated) {
    const progress = ((memory.capturedAtMs ?? earliest) - earliest) / span;
    const angle = progress * Math.PI * 4.5;
    const local = seededUnit(memory.id, input.viewportSeed) - 0.5;
    positions[memory.id] = finiteVec3([
      Math.sin(angle) * (2.4 + progress * 1.2) + local * 0.9,
      Math.cos(angle * 0.55) * 1.4 + local * 0.45,
      -8 + progress * 12,
    ]);
  }

  missing.forEach((memory, index) => {
    const angle = index * 1.7 + seededUnit(memory.id, input.viewportSeed);
    positions[memory.id] = finiteVec3([
      -5.5 + Math.cos(angle) * 1.2,
      -2.8 + Math.sin(angle) * 0.8,
      -3 + index * 0.15,
    ]);
  });
  return positions;
}
