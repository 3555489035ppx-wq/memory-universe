import type { Memory } from '../../domain/memory';
import { seededSigned, seededUnit } from '../engine/seededRandom';
import { sortedMemories, transform, type TemplateLayoutMap } from './shared';

export function createScatteredLayout(
  memories: readonly Memory[],
  seed: number,
  heroPhotoId: string | null,
): TemplateLayoutMap {
  const result: TemplateLayoutMap = {};
  const ordered = sortedMemories(memories);
  ordered.forEach((memory, index) => {
    const angle = index * 2.399963 + seededUnit(memory.id, seed) * 0.7;
    const radius = 0.35 + Math.sqrt(index + 1) * 0.72;
    const x = Math.max(-6.2, Math.min(6.2, Math.cos(angle) * radius + seededSigned(memory.id, seed + 11) * 0.65));
    const y = Math.max(-3.4, Math.min(3.4, Math.sin(angle) * radius * 0.58 + seededSigned(memory.id, seed + 17) * 0.45));
    const z = -3.6 + seededUnit(memory.id, seed + 23) * 5.7;
    const hiddenHero = heroPhotoId === memory.id;
    result[memory.id] = transform(
      [x, y, z],
      [seededSigned(memory.id, seed + 31) * 0.1, seededSigned(memory.id, seed + 37) * 0.2, seededSigned(memory.id, seed + 41) * 0.05],
      hiddenHero ? 0.78 : 0.82,
      hiddenHero ? 0 : 0.84,
    );
  });
  return result;
}
