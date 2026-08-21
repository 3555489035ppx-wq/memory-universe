import type { Memory } from '../../domain/memory';
import { enforcePhotoSeparation } from './enforcePhotoSeparation';
import { analyzeLayoutDiagnostics, needsClusteredTimeFallback } from './layoutDiagnostics';
import { finiteVec3, seededUnit, type LayoutInput, type LayoutPositions } from './layoutTypes';

function timestamp(memory: Memory, fallback: number): number {
  return memory.capturedAtMs ?? fallback;
}

function distributeChronologicalRibbon(
  memories: readonly Memory[],
  viewportSeed: number,
  center: readonly [number, number],
): LayoutPositions {
  const positions: LayoutPositions = {};
  if (memories.length === 0) return positions;
  const columns = Math.max(2, Math.ceil(Math.sqrt(memories.length * 1.45)));
  const rows = Math.ceil(memories.length / columns);

  memories.forEach((memory, index) => {
    const row = Math.floor(index / columns);
    const rowStart = row * columns;
    const itemsInRow = Math.min(columns, memories.length - rowStart);
    const column = index - rowStart;
    const jitter = seededUnit(memory.id, viewportSeed) - 0.5;
    const depthProgress = memories.length <= 1 ? 0.5 : index / (memories.length - 1);
    positions[memory.id] = finiteVec3([
      center[0] + (column - (itemsInRow - 1) / 2) * 1.18 + jitter * 0.12,
      center[1] + ((rows - 1) / 2 - row) * 1.04 + Math.sin(column * 0.72) * 0.12,
      -7 + depthProgress * 10 + ((index % 3) - 1) * 0.12,
    ]);
  });
  return positions;
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
  const diagnostics = analyzeLayoutDiagnostics(input.memories);

  if (needsClusteredTimeFallback(diagnostics)) {
    const datedPositions = distributeChronologicalRibbon(dated, input.viewportSeed, [0, missing.length > 0 ? 1.1 : 0]);
    const missingPositions = distributeChronologicalRibbon(
      missing,
      input.viewportSeed + 911,
      dated.length > 0 ? [-4.8, -3.2] : [0, 0],
    );
    return enforcePhotoSeparation(
      { ...datedPositions, ...missingPositions },
      input.memories,
      { gap: 0.16, depthThreshold: 1.8, iterations: 10 },
    );
  }

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
    const angle = index * 2.399_963 + seededUnit(memory.id, input.viewportSeed);
    const radius = 0.6 + Math.sqrt(index) * 0.74;
    positions[memory.id] = finiteVec3([
      -5.5 + Math.cos(angle) * radius,
      -2.8 + Math.sin(angle) * radius * 0.72,
      -3 + index * 0.15,
    ]);
  });
  return positions;
}
