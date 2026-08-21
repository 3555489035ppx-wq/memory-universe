import type { Memory } from '../../domain/memory';
import { seededSigned, seededUnit } from '../engine/seededRandom';
import { sortedMemories, transform, type TemplateLayoutMap } from './shared';

export function createRibbonLayout(memories: readonly Memory[], seed: number, heroPhotoId: string | null): TemplateLayoutMap {
  const result: TemplateLayoutMap = {};
  const ordered = sortedMemories(memories);
  ordered.forEach((memory, index) => {
    const laneSize = 40;
    const cycle = Math.floor(index / laneSize);
    const laneStart = cycle * laneSize;
    const laneCount = Math.min(laneSize, ordered.length - laneStart);
    const slot = index - laneStart;
    const t = laneCount <= 1 ? 0.5 : slot / (laneCount - 1);
    const angle = t * Math.PI * 4.6;
    const hero = memory.id === heroPhotoId;
    result[memory.id] = transform(
      hero ? [0, 0.1, 1.9] : [-5.8 + t * 11.6 + cycle * 0.16, Math.sin(angle) * 2.08 - cycle * 0.14, -1.05 + Math.cos(angle) * 1.4 + cycle * 0.2],
      hero ? [0, 0, 0] : [seededSigned(memory.id, seed + 5) * 0.04, Math.sin(angle) * -0.12, Math.cos(angle) * 0.08],
      hero ? 1.16 : 0.92 + seededUnit(memory.id, seed + 11) * 0.1,
      hero ? 1 : 0.87,
    );
  });
  return result;
}
