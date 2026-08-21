import type { Memory } from '../../domain/memory';
import { seededSigned, seededUnit } from '../engine/seededRandom';
import { sortedMemories, transform, type TemplateLayoutMap } from './shared';

export function createTunnelLayout(memories: readonly Memory[], seed: number, heroPhotoId: string | null): TemplateLayoutMap {
  const result: TemplateLayoutMap = {};
  const ordered = sortedMemories(memories);
  const lanes = 12;
  ordered.forEach((memory, index) => {
    const slot = index % 48;
    const depth = Math.floor(slot / lanes);
    const lane = slot % lanes;
    const angle = (lane / lanes) * Math.PI * 2 + seededSigned(memory.id, seed) * 0.09;
    const radiusX = 3.65 + (depth % 2) * 0.65;
    const radiusY = 2.42 + (depth % 3) * 0.24;
    const hero = memory.id === heroPhotoId;
    result[memory.id] = transform(
      hero ? [0, 0, 2.15] : [Math.cos(angle) * radiusX, Math.sin(angle) * radiusY, 3.4 - depth * 2.25],
      hero ? [0, 0, 0] : [Math.sin(angle) * -0.08, -angle + Math.PI / 2, seededSigned(memory.id, seed + 13) * 0.06],
      hero ? 1.18 : 0.72 + seededUnit(memory.id, seed + 19) * 0.12,
      hero ? 1 : 0.88,
    );
  });
  return result;
}
