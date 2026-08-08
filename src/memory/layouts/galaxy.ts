import type { Memory } from '../../domain/memory';
import { seededSigned, seededUnit } from '../engine/seededRandom';
import { sortedMemories, transform, type TemplateLayoutMap } from './shared';

export function createGalaxyLayout(memories: readonly Memory[], seed: number, heroPhotoId: string | null): TemplateLayoutMap {
  const result: TemplateLayoutMap = {};
  const ordered = sortedMemories(memories);
  const lanes = [
    { radius: 4.2, x: 0.32, z: -0.8, tilt: 0.3 },
    { radius: 5.5, x: -0.38, z: 0, tilt: -0.2 },
    { radius: 6.8, x: 0.24, z: -1.6, tilt: 0.48 },
  ] as const;
  ordered.forEach((memory, index) => {
    const lane = lanes[index % lanes.length] ?? lanes[0];
    const laneIndex = Math.floor(index / lanes.length);
    const laneTotal = Math.max(1, Math.ceil(ordered.length / lanes.length));
    const angle = (laneIndex / laneTotal) * Math.PI * 2 + seededUnit(memory.id, seed) * 0.24;
    const hero = memory.id === heroPhotoId;
    result[memory.id] = transform(
      hero ? [0, 0, 1.8] : [Math.cos(angle) * lane.radius, Math.sin(angle) * lane.radius * 0.42, lane.z + Math.sin(angle * 2) * 0.7],
      hero ? [0, 0, 0] : [lane.x * Math.sin(angle), -angle + Math.PI / 2, seededSigned(memory.id, seed + 9) * 0.06],
      hero ? 1.1 : 0.78 + seededUnit(memory.id, seed + 11) * 0.08,
      hero ? 1 : 0.85,
    );
  });
  return result;
}
