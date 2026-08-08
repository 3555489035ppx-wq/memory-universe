import type { Mood } from '../../domain/memory';
import { finiteVec3, seededUnit, type LayoutInput, type LayoutPositions } from './layoutTypes';

const MOOD_ANCHORS: Readonly<Record<Exclude<Mood, null> | 'unmarked', readonly [number, number, number]>> = {
  happy: [-4.5, 2.4, 1.4],
  calm: [0, 3.4, -0.6],
  nostalgic: [4.5, 2.1, -2],
  excited: [-4.2, -2.3, 2.2],
  chaotic: [0.2, -3.4, 0.6],
  lonely: [4.8, -2.5, -3],
  unmarked: [0, 0, -5],
};

export function createEmotionLayout(input: LayoutInput): LayoutPositions {
  const positions: LayoutPositions = {};
  for (const memory of input.memories.toSorted((left, right) => left.id.localeCompare(right.id))) {
    const anchor = MOOD_ANCHORS[memory.mood ?? 'unmarked'];
    const angle = seededUnit(memory.id, input.viewportSeed) * Math.PI * 2;
    const density = memory.mood === 'chaotic' ? 1.8 : memory.mood === 'calm' ? 0.75 : 1.15;
    positions[memory.id] = finiteVec3([
      anchor[0] + Math.cos(angle) * density,
      anchor[1] + Math.sin(angle) * density,
      anchor[2] + (seededUnit(memory.id, input.viewportSeed + 3) - 0.5) * density * 2,
    ]);
  }
  return positions;
}
