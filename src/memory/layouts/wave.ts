import type { Memory } from '../../domain/memory';
import { seededSigned, seededUnit } from '../engine/seededRandom';
import { aspectScale, sortedMemories, transform, type TemplateLayoutMap } from './shared';

/** A compact six-lane wave surface, not a sparse four-row strip. */
export function createWaveLayout(
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
    const cycle = Math.floor(index / slots);
    const row = Math.floor(slot / columns);
    const column = slot % columns;
    const t = column / (columns - 1);
    const phase = t * Math.PI * 2.35 + row * 0.62;
    const x = -4.7 + t * 9.4 + Math.sin(row * 0.8) * 0.16 + seededSigned(memory.id, seed + 3) * 0.1;
    const y = 1.4 - row * 0.56 + Math.sin(phase) * 0.3 - cycle * 0.08;
    const z = -1.3 + Math.cos(phase) * 0.9 + row * 0.12 + cycle * 0.16;
    const hero = memory.id === heroPhotoId;

    result[memory.id] = transform(
      [x, y, z],
      [Math.sin(phase) * 0.035, Math.cos(phase) * -0.09, Math.cos(phase) * 0.055],
      (hero ? 1 : 0.9 + seededUnit(memory.id, seed + 7) * 0.1) * aspectScale(memory),
      hero ? 1 : 0.9,
    );
  });

  return result;
}
