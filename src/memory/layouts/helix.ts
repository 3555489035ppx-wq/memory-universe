import type { Memory } from '../../domain/memory';
import { seededSigned, seededUnit } from '../engine/seededRandom';
import { sortedMemories, transform, type TemplateLayoutMap } from './shared';

export function createHelixLayout(memories: readonly Memory[], seed: number, heroPhotoId: string | null): TemplateLayoutMap {
  const result: TemplateLayoutMap = {};
  const ordered = sortedMemories(memories);
  ordered.forEach((memory, index) => {
    const slot = index % 48;
    const normalized = slot / 47;
    const angle = slot * 0.66 + seededUnit(memory.id, seed) * 0.18;
    const hero = memory.id === heroPhotoId;
    result[memory.id] = transform(
      hero ? [0, normalized * 10.5 - 4.8, 1.6] : [3.6 * Math.cos(angle), -4.8 + normalized * 10.5, 3.6 * Math.sin(angle) - 1],
      hero ? [0, 0, 0] : [0, -angle + Math.PI / 2, seededSigned(memory.id, seed + 9) * 0.04],
      hero ? 1.12 : 0.82,
      hero ? 1 : 0.85,
    );
  });
  return result;
}
