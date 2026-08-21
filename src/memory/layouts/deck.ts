import type { Memory } from '../../domain/memory';
import { seededSigned, seededUnit } from '../engine/seededRandom';
import { aspectScale, sortedMemories, transform, type TemplateLayoutMap } from './shared';

/** A set of overlapping photo fans, closer to editing-room contact prints. */
export function createDeckLayout(
  memories: readonly Memory[],
  seed: number,
  heroPhotoId: string | null,
): TemplateLayoutMap {
  const result: TemplateLayoutMap = {};
  const ordered = sortedMemories(memories);
  const slots = 48;

  ordered.forEach((memory, index) => {
    const slot = index % slots;
    const fan = slot % 3;
    const fanIndex = Math.floor(slot / 3);
    const fanTotal = 16;
    const t = fanIndex / (fanTotal - 1);
    const x = -5.05 + t * 10.1 + (fan - 1) * 0.34;
    const arc = Math.sin(t * Math.PI);
    const y = (fan - 1) * 1.45 + arc * (0.8 + fan * 0.12) + seededSigned(memory.id, seed + 5) * 0.16;
    const z = -1.15 + fan * 0.52 + arc * 0.72 + seededSigned(memory.id, seed + 9) * 0.12;
    const hero = memory.id === heroPhotoId;

    result[memory.id] = transform(
      [x, y, z],
      [0, seededSigned(memory.id, seed + 11) * 0.08, (t - 0.5) * 0.28 + seededSigned(memory.id, seed + 13) * 0.07],
      (hero ? 1 : 0.9 + seededUnit(memory.id, seed + 17) * 0.1) * aspectScale(memory),
      hero ? 1 : 0.9,
    );
  });

  return result;
}
