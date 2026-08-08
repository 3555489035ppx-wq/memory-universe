import type { Memory } from '../../domain/memory';
import { seededSigned, seededUnit } from '../engine/seededRandom';
import { sortedMemories, transform, type TemplateLayoutMap } from './shared';

export function createHeartLayout(
  memories: readonly Memory[],
  seed: number,
  heroPhotoId: string | null,
): TemplateLayoutMap {
  const result: TemplateLayoutMap = {};
  const ordered = sortedMemories(memories);
  const layers = Math.min(3, Math.max(1, Math.ceil(ordered.length / 6)));
  ordered.forEach((memory, index) => {
    const layer = index % layers;
    const layerIndex = Math.floor(index / layers);
    const layerTotal = Math.max(1, Math.ceil(ordered.length / layers));
    const t = (layerIndex / layerTotal) * Math.PI * 2 - Math.PI;
    const rawX = 16 * Math.sin(t) ** 3;
    const rawY = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    const hero = heroPhotoId === memory.id;
    const x = hero ? 0 : rawX * 0.34 + seededSigned(memory.id, seed + 3) * 0.16;
    const y = hero ? -0.25 : rawY * 0.28 - 0.4 + seededSigned(memory.id, seed + 5) * 0.16;
    const z = hero ? 1.9 : (layer - (layers - 1) / 2) * 1.25 + seededSigned(memory.id, seed + 7) * 0.18;
    result[memory.id] = transform(
      [x, y, z],
      hero ? [0, 0, 0] : [0, Math.atan2(rawX, rawY) * 0.3, seededSigned(memory.id, seed + 11) * 0.05],
      hero ? 1.12 : 0.8 + seededUnit(memory.id, seed + 13) * 0.08,
      hero ? 1 : 0.86,
    );
  });
  return result;
}
