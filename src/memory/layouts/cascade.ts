import type { Memory } from '../../domain/memory';
import { seededSigned } from '../engine/seededRandom';
import { sortedMemories, transform, type TemplateLayoutMap } from './shared';
import { packJustifiedPhotoRows } from './slotPacking';

export function createCascadeLayout(memories: readonly Memory[], seed: number, heroPhotoId: string | null): TemplateLayoutMap {
  const result: TemplateLayoutMap = {};
  const ordered = sortedMemories(memories);
  const slots = packJustifiedPhotoRows(ordered, {
    maxWidth: 10.45,
    maxHeight: 5.4,
    targetRowHeight: 0.82,
    gap: 0.09,
  });
  ordered.forEach((memory) => {
    const slot = slots[memory.id];
    if (!slot) return;
    const hero = memory.id === heroPhotoId;
    result[memory.id] = transform(
      [slot.position[0], slot.position[1], -0.3 - slot.row * 0.15 + seededSigned(memory.id, seed) * 0.12 + (hero ? 0.45 : 0)],
      hero ? [0, 0, 0] : [0, seededSigned(memory.id, seed + 7) * 0.055, seededSigned(memory.id, seed + 13) * 0.025],
      slot.scale,
      hero ? 1 : 0.88,
    );
  });
  return result;
}
