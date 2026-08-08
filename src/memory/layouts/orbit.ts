import type { Memory } from '../../domain/memory';
import { seededSigned, seededUnit } from '../engine/seededRandom';
import { sortedMemories, transform, type TemplateLayoutMap } from './shared';

const LAYERS = [
  { radiusX: 6.2, radiusY: 3.3, zBase: -1.8, depth: 1.35 },
  { radiusX: 4.5, radiusY: 2.35, zBase: -0.2, depth: 1.05 },
  { radiusX: 2.8, radiusY: 1.45, zBase: 0.9, depth: 0.72 },
] as const;

export function createOrbitLayout(
  memories: readonly Memory[],
  seed: number,
  heroPhotoId: string | null,
): TemplateLayoutMap {
  const result: TemplateLayoutMap = {};
  const ordered = sortedMemories(memories);
  const layerCount = ordered.length < 3 ? 1 : ordered.length < 11 ? 2 : 3;
  const counts = Array.from({ length: layerCount }, () => 0);
  ordered.forEach((memory, index) => {
    const layer = index % layerCount;
    const layerInfo = LAYERS[layer] ?? LAYERS[0];
    const countInLayer = counts[layer] ?? 0;
    counts[layer] = countInLayer + 1;
    const count = Math.max(1, Math.ceil(ordered.length / layerCount));
    const angle = layer * 0.7 + (countInLayer / count) * Math.PI * 2 + seededUnit(memory.id, seed) * 0.18;
    const x = layerInfo.radiusX * Math.cos(angle) + seededSigned(memory.id, seed + 5) * 0.18;
    const y = layerInfo.radiusY * Math.sin(angle) + seededSigned(memory.id, seed + 7) * 0.18;
    const z = layerInfo.zBase + Math.sin(angle * 2 + seededUnit(memory.id, seed + 9) * Math.PI) * layerInfo.depth;
    const hero = heroPhotoId === memory.id;
    result[memory.id] = transform(
      hero ? [0, 0.15, 1.6] : [x, y, z],
      hero ? [0, 0, 0] : [0, -angle + Math.PI / 2, seededSigned(memory.id, seed + 13) * 0.04],
      hero ? 1.18 : 0.82,
      hero ? 1 : 0.88,
    );
  });
  return result;
}
