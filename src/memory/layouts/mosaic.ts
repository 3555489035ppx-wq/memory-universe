import type { Memory } from '../../domain/memory';
import { seededSigned, seededUnit } from '../engine/seededRandom';
import { sortedMemories, transform, type TemplateLayoutMap } from './shared';
import { packJustifiedPhotoRows } from './slotPacking';

export function createMosaicLayout(memories: readonly Memory[], seed: number, heroPhotoId: string | null): TemplateLayoutMap {
  const result: TemplateLayoutMap = {};
  const ordered = sortedMemories(memories);
  const slots = packJustifiedPhotoRows(ordered, {
    maxWidth: 10.6,
    maxHeight: 5.35,
    targetRowHeight: 0.86,
    gap: 0.075,
  });
  ordered.forEach((memory) => {
    const slot = slots[memory.id];
    if (!slot) return;
    const hero = memory.id === heroPhotoId;
    result[memory.id] = transform(
      [slot.position[0], slot.position[1], -1.15 + seededUnit(memory.id, seed) * 0.38 + (hero ? 0.45 : 0)],
      hero ? [0, 0, 0] : [0, seededSigned(memory.id, seed + 11) * 0.055, seededSigned(memory.id, seed + 17) * 0.025],
      slot.scale,
      hero ? 1 : 0.9,
    );
  });
  return result;
}
