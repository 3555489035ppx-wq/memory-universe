import type { Memory } from '../../domain/memory';
import { seededSigned, seededUnit } from '../engine/seededRandom';
import { aspectScale, sortedMemories, transform, type TemplateLayoutMap } from './shared';

/**
 * A loose photographic pile that acts as the resting state for gravity-drop.
 * Rows overlap like prints landing on a table instead of forming a rigid grid.
 */
export function createGravityLayout(
  memories: readonly Memory[],
  seed: number,
  heroPhotoId: string | null,
): TemplateLayoutMap {
  const result: TemplateLayoutMap = {};
  const ordered = sortedMemories(memories);
  const columns = 8;
  const slots = 48;

  ordered.forEach((memory, index) => {
    const slot = index % slots;
    const row = Math.floor(slot / columns);
    const column = slot % columns;
    const rowOffset = row % 2 === 0 ? 0 : 0.56;
    const x = -4.35 + column * 1.24 + rowOffset + seededSigned(memory.id, seed + 3) * 0.2;
    const y = -2.35 + row * 0.42 + seededUnit(memory.id, seed + 7) * 0.16;
    const z = 0.5 - row * 0.24 + seededSigned(memory.id, seed + 11) * 0.18;
    const hero = memory.id === heroPhotoId;

    result[memory.id] = transform(
      [x, y, z],
      [0, seededSigned(memory.id, seed + 13) * 0.08, seededSigned(memory.id, seed + 17) * 0.2],
      (hero ? 0.96 : 0.9 + seededUnit(memory.id, seed + 19) * 0.1) * aspectScale(memory),
      hero ? 1 : 0.92,
    );
  });

  return result;
}
