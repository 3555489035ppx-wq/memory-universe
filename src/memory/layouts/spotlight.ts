import type { Memory } from '../../domain/memory';
import { seededSigned, seededUnit } from '../engine/seededRandom';
import { sortedMemories, transform, type TemplateLayoutMap } from './shared';

export function createSpotlightLayout(memories: readonly Memory[], seed: number, heroPhotoId: string | null): TemplateLayoutMap {
  const result: TemplateLayoutMap = {};
  const ordered = sortedMemories(memories);
  const supportAnchors: readonly (readonly [number, number])[] = [
    [-1.55, -1.02], [1.55, -1.02],
    [-1.78, -0.1], [1.78, -0.1],
    [-1.48, 1.0], [1.48, 1.0],
    [0, -1.46], [0, 1.46],
  ];
  let supportingIndex = 0;
  ordered.forEach((memory) => {
    const hero = memory.id === heroPhotoId;
    if (hero) {
      result[memory.id] = transform([0, 0.05, 2.15], [0, 0, 0], 1.66, 1);
      return;
    }
    const anchor = supportAnchors[supportingIndex % supportAnchors.length] ?? [0, 0];
    const supportLayer = Math.floor(supportingIndex / supportAnchors.length);
    const layerScale = 1 + supportLayer * 0.14;
    supportingIndex += 1;
    result[memory.id] = transform(
      [anchor[0] * layerScale, anchor[1] * layerScale, 0.82 - supportLayer * 0.26],
      [0, Math.sign(anchor[0]) * -0.16, seededSigned(memory.id, seed + 5) * 0.05],
      0.42 + seededUnit(memory.id, seed + 11) * 0.04,
      // The opening is intentionally a single-image statement. Showing a few
      // small, disconnected supports around the hero read as isolated leftovers
      // rather than a composition; the chapter after the opening introduces the
      // wider connected photo surface.
      0.04,
    );
  });
  return result;
}
