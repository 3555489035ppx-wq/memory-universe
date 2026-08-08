import type { Memory } from '../../domain/memory';
import { seededSigned } from '../engine/seededRandom';
import { createHeartLayout } from './heart';
import type { TemplateLayoutMap } from './shared';

export function createBrokenHeartLayout(
  memories: readonly Memory[],
  seed: number,
  heroPhotoId: string | null,
  separation = 1,
): TemplateLayoutMap {
  const heart = createHeartLayout(memories, seed, heroPhotoId);
  const result: TemplateLayoutMap = {};
  memories.forEach((memory, index) => {
    const base = heart[memory.id];
    if (!base) return;
    const side = index % 2 === 0 ? -1 : 1;
    const hero = heroPhotoId === memory.id;
    result[memory.id] = {
      ...base,
      position: hero
        ? base.position
        : [
            base.position[0] + side * 4.2 * separation,
            base.position[1] + seededSigned(memory.id, seed + 21) * 0.35 * separation,
            base.position[2] + seededSigned(memory.id, seed + 23) * 0.7 * separation,
          ],
      rotation: hero
        ? base.rotation
        : [base.rotation[0], base.rotation[1] + side * 0.14 * separation, base.rotation[2]],
      opacity: hero ? base.opacity : Math.max(0.72, base.opacity),
    };
  });
  return result;
}
