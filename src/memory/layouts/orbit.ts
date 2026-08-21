import type { Memory } from '../../domain/memory';
import { seededSigned, seededUnit } from '../engine/seededRandom';
import { sortedMemories, transform, type TemplateLayoutMap } from './shared';

const LAYERS = [
  // A close orbit reads as one 3D object; the old outer radius left lone
  // thumbnails at the four corners once the camera moved in.
  { radiusX: 4.15, radiusY: 2.2, zBase: -1.6, depth: 1.2 },
  { radiusX: 2.95, radiusY: 1.58, zBase: -0.15, depth: 0.95 },
  { radiusX: 1.72, radiusY: 0.92, zBase: 0.85, depth: 0.65 },
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
    const slot = index % 48;
    const layer = slot % layerCount;
    const layerInfo = LAYERS[layer] ?? LAYERS[0];
    const countInLayer = counts[layer] ?? 0;
    counts[layer] = countInLayer + 1;
    const count = Math.max(1, Math.ceil(48 / layerCount));
    const angle = layer * 0.7 + (countInLayer / count) * Math.PI * 2 + seededUnit(memory.id, seed) * 0.18;
    const x = layerInfo.radiusX * Math.cos(angle) + seededSigned(memory.id, seed + 5) * 0.18;
    const y = layerInfo.radiusY * Math.sin(angle) + seededSigned(memory.id, seed + 7) * 0.18;
    const z = layerInfo.zBase + Math.sin(angle * 2 + seededUnit(memory.id, seed + 9) * Math.PI) * layerInfo.depth;
    const hero = heroPhotoId === memory.id;
    result[memory.id] = transform(
      hero ? [0, 0.15, 1.6] : [x, y, z],
      hero ? [0, 0, 0] : [0, -angle + Math.PI / 2, seededSigned(memory.id, seed + 13) * 0.04],
      hero ? 1.18 : 0.9,
      hero ? 1 : 0.88,
    );
  });
  return result;
}
