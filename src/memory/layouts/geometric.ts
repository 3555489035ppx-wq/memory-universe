import type { Memory } from '../../domain/memory';
import { seededSigned, seededUnit } from '../engine/seededRandom';
import { sortedMemories, transform, type TemplateLayoutMap } from './shared';

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

function layerFor(index: number): { slot: number; layer: number } {
  return { slot: index % 48, layer: Math.floor(index / 48) };
}

/** Photos distributed on an ellipsoid so depth reads as a real volume. */
export function createSphereLayout(
  memories: readonly Memory[],
  seed: number,
  heroPhotoId: string | null,
): TemplateLayoutMap {
  const result: TemplateLayoutMap = {};
  sortedMemories(memories).forEach((memory, index) => {
    const { slot, layer } = layerFor(index);
    const latitude = 1 - ((slot + 0.5) / 48) * 2;
    const radial = Math.sqrt(Math.max(0.08, 1 - latitude * latitude));
    const angle = slot * GOLDEN_ANGLE + seededSigned(memory.id, seed + 3) * 0.12 + layer * 0.24;
    const hero = memory.id === heroPhotoId;
    result[memory.id] = transform(
      hero
        ? [0, 0, 1.9]
        : [
            Math.cos(angle) * radial * (3.35 + layer * 0.22),
            latitude * (2.25 + layer * 0.16),
            Math.sin(angle) * radial * (3.05 + layer * 0.18) - 0.72 + layer * 0.18,
          ],
      hero
        ? [0, 0, 0]
        : [
            -latitude * 0.18,
            -angle + Math.PI / 2,
            seededSigned(memory.id, seed + 11) * 0.08,
          ],
      hero ? 1.12 : 0.72 + seededUnit(memory.id, seed + 17) * 0.1,
      hero ? 1 : 0.88,
    );
  });
  return result;
}

/** Photos follow a five-point star outline with a shallow 3D twist. */
export function createStarLayout(
  memories: readonly Memory[],
  seed: number,
  heroPhotoId: string | null,
): TemplateLayoutMap {
  const result: TemplateLayoutMap = {};
  sortedMemories(memories).forEach((memory, index) => {
    const { slot, layer } = layerFor(index);
    const point = slot % 10;
    const radius = point % 2 === 0 ? 4.18 : 2.02;
    const angle = -Math.PI / 2 + point * Math.PI / 5 + seededSigned(memory.id, seed + 5) * 0.035;
    const alongPoint = Math.floor(slot / 10) * 0.035;
    const hero = memory.id === heroPhotoId;
    result[memory.id] = transform(
      hero
        ? [0, 0, 1.9]
        : [
            Math.cos(angle) * (radius + alongPoint),
            Math.sin(angle) * (radius + alongPoint) * 0.72,
            Math.sin(slot * 0.82 + layer * 0.7) * 0.66 - 0.55 + layer * 0.18,
          ],
      hero
        ? [0, 0, 0]
        : [
            seededSigned(memory.id, seed + 7) * 0.14,
            -angle + Math.PI / 2,
            seededSigned(memory.id, seed + 13) * 0.1,
          ],
      hero ? 1.12 : 0.68 + seededUnit(memory.id, seed + 19) * 0.12,
      hero ? 1 : 0.88,
    );
  });
  return result;
}

/** Photos wrap around a torus, leaving a deliberate negative-space centre. */
export function createTorusLayout(
  memories: readonly Memory[],
  seed: number,
  heroPhotoId: string | null,
): TemplateLayoutMap {
  const result: TemplateLayoutMap = {};
  sortedMemories(memories).forEach((memory, index) => {
    const { slot, layer } = layerFor(index);
    const majorRadius = 2.55 + layer * 0.18;
    const tubeRadius = 0.92 + seededUnit(memory.id, seed + 5) * 0.18;
    const around = (slot / 48) * Math.PI * 2 + layer * 0.13;
    const tube = (slot % 8) / 8 * Math.PI * 2 + seededSigned(memory.id, seed + 7) * 0.08;
    const hero = memory.id === heroPhotoId;
    result[memory.id] = transform(
      hero
        ? [0, 0, 1.9]
        : [
            (majorRadius + Math.cos(tube) * tubeRadius) * Math.cos(around),
            (majorRadius + Math.cos(tube) * tubeRadius) * Math.sin(around) * 0.68,
            Math.sin(tube) * tubeRadius - 0.72 + layer * 0.16,
          ],
      hero
        ? [0, 0, 0]
        : [
            Math.cos(tube) * 0.18,
            -around + Math.PI / 2,
            seededSigned(memory.id, seed + 11) * 0.08,
          ],
      hero ? 1.12 : 0.7 + seededUnit(memory.id, seed + 17) * 0.1,
      hero ? 1 : 0.88,
    );
  });
  return result;
}

/** Photos occupy the six faces of a shallow hexagonal prism. */
export function createPrismLayout(
  memories: readonly Memory[],
  seed: number,
  heroPhotoId: string | null,
): TemplateLayoutMap {
  const result: TemplateLayoutMap = {};
  sortedMemories(memories).forEach((memory, index) => {
    const { slot, layer } = layerFor(index);
    const side = slot % 6;
    const heightIndex = Math.floor(slot / 6);
    const heightT = heightIndex / 7;
    const angle = side * Math.PI / 3 + Math.PI / 6;
    const radius = 2.55 + layer * 0.18;
    const hero = memory.id === heroPhotoId;
    result[memory.id] = transform(
      hero
        ? [0, 0, 1.9]
        : [
            Math.cos(angle) * radius,
            -2.1 + heightT * 4.2,
            Math.sin(angle) * radius - 0.8 + layer * 0.16,
          ],
      hero
        ? [0, 0, 0]
        : [
            seededSigned(memory.id, seed + 3) * 0.08,
            -angle + Math.PI / 2,
            seededSigned(memory.id, seed + 11) * 0.08,
          ],
      hero ? 1.12 : 0.7 + seededUnit(memory.id, seed + 17) * 0.1,
      hero ? 1 : 0.88,
    );
  });
  return result;
}
