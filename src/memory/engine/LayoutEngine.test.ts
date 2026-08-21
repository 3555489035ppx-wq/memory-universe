import { describe, expect, it } from 'vitest';

import type { Memory } from '../../domain/memory';
import { getMemoryTemplate } from '../config';
import { layoutEngine } from './LayoutEngine';
import { dimensions } from '../layouts/shared';

function memory(id: string, index: number): Memory {
  return {
    id,
    source: 'demo',
    title: id,
    description: '',
    capturedAt: `2024-01-0${String(index + 1)}`,
    capturedAtMs: Date.UTC(2024, 0, index + 1),
    dateSource: 'manual',
    personIds: [],
    placeId: null,
    mood: null,
    tags: [],
    dominantColor: { rgb: [120, 140, 160], hsl: [210, 20, 50], luminance: 0.4, algorithmVersion: 1 },
    assetKeys: { micro: `micro-${id}`, thumbnail: `thumb-${id}`, preview: `preview-${id}` },
    width: 1200,
    height: 800,
    orientationApplied: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    schemaVersion: 1,
  };
}

describe('template layout engine', () => {
  const memories = Array.from({ length: 18 }, (_, index) => memory(`memory-${String(index)}`, index));

  it('is deterministic and returns finite transforms for every supported layout', () => {
    const config = getMemoryTemplate('high-school');
    const heroPhotoId = memories[8]?.id ?? null;
    const first = layoutEngine.prepare(config, memories, heroPhotoId);
    const second = layoutEngine.prepare(config, memories, heroPhotoId);
    expect(first).toEqual(second);
    for (const layout of Object.values(first)) {
      for (const transform of Object.values(layout)) {
        expect(transform.position.every(Number.isFinite)).toBe(true);
        expect(transform.rotation.every(Number.isFinite)).toBe(true);
        expect(Number.isFinite(transform.scale)).toBe(true);
        expect(Number.isFinite(transform.opacity)).toBe(true);
      }
    }
  });

  it('reserves the chosen hero for the opening instead of pinning it across every layout', () => {
    const config = getMemoryTemplate('high-school');
    const heroId = memories[8]?.id ?? null;
    const orbit = layoutEngine.prepare(config, memories, heroId).orbit[heroId ?? ''];
    expect(orbit).toBeDefined();
    expect(orbit?.position).not.toEqual([0, 0.15, 1.6]);
    const spotlight = layoutEngine.prepare(config, memories, heroId).spotlight[heroId ?? ''];
    expect(spotlight?.position[2]).toBeGreaterThan(2);
    expect(spotlight?.scale).toBeGreaterThan(1.55);
    expect(spotlight?.scale).toBeLessThan(1.75);
  });

  it('preserves wide, square and portrait ratios at comparable visual area', () => {
    const base = memories[0];
    if (!base) throw new Error('Expected a fixture memory.');
    const candidates = [
      { ...base, width: 900, height: 1600 },
      { ...base, width: 800, height: 1000 },
      { ...base, width: 1000, height: 1000 },
      { ...base, width: 1500, height: 1000 },
      { ...base, width: 1600, height: 900 },
      { ...base, width: 3000, height: 1000 },
    ];

    for (const candidate of candidates) {
      const [width, height] = dimensions(candidate);
      expect(width * height).toBeCloseTo(1, 6);
      expect(width / height).toBeCloseTo(candidate.width / candidate.height, 6);
    }
  });

  it('keeps the complete photo group large enough to read without one oversized hero', () => {
    const config = getMemoryTemplate('high-school');
    const prepared = layoutEngine.prepare(config, memories, memories[8]?.id ?? null);
    const storyLayouts = ['wave', 'deck', 'orbit', 'galaxy', 'scattered', 'ribbon', 'cascade', 'gravity', 'mosaic'] as const;

    for (const layout of storyLayouts) {
      const transforms = Object.values(prepared[layout]);
      const averageScale = transforms.reduce((total, candidate) => total + candidate.scale, 0) / transforms.length;
      expect(averageScale, layout).toBeGreaterThan(0.84);
    }
  });

  it('creates distinct volumetric geometric silhouettes for the new shape scenes', () => {
    const config = getMemoryTemplate('high-school');
    const prepared = layoutEngine.prepare(config, memories, memories[8]?.id ?? null);
    for (const layout of ['sphere', 'star', 'torus', 'prism'] as const) {
      const transforms = Object.values(prepared[layout]);
      expect(transforms).toHaveLength(memories.length);
      expect(new Set(transforms.map((candidate) => candidate.position[2].toFixed(3))).size, layout).toBeGreaterThan(3);
      expect(new Set(transforms.map((candidate) => candidate.rotation[1].toFixed(3))).size, layout).toBeGreaterThan(4);
    }
  });
});
