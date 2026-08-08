import { describe, expect, it } from 'vitest';

import type { Memory } from '../../domain/memory';
import { getMemoryTemplate } from '../config';
import { layoutEngine } from './LayoutEngine';

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

  it('keeps the high-school orbit hero in front of the orbit', () => {
    const config = getMemoryTemplate('high-school');
    const heroId = memories[8]?.id ?? null;
    const orbit = layoutEngine.prepare(config, memories, heroId).orbit[heroId ?? ''];
    expect(orbit).toBeDefined();
    expect(orbit?.position).toEqual([0, 0.15, 1.6]);
  });
});
