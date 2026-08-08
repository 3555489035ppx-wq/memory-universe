import { describe, expect, it } from 'vitest';

import type { Memory } from '../../domain/memory';
import { getMemoryTemplate } from '../config';
import { layoutEngine } from './LayoutEngine';
import { evaluateTemplateState } from './TimelineEngine';

function memory(id: string): Memory {
  return {
    id,
    source: 'demo',
    title: id,
    description: '',
    capturedAt: null,
    capturedAtMs: null,
    dateSource: 'unknown',
    personIds: [],
    placeId: null,
    mood: null,
    tags: [],
    dominantColor: { rgb: [100, 100, 100], hsl: [0, 0, 40], luminance: 0.3, algorithmVersion: 1 },
    assetKeys: { micro: `micro-${id}`, thumbnail: `thumb-${id}`, preview: `preview-${id}` },
    width: 900,
    height: 900,
    orientationApplied: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    schemaVersion: 1,
  };
}

describe('template timeline engine', () => {
  it('supports random access and exact high-school phase boundaries', () => {
    const config = getMemoryTemplate('high-school');
    const memories = ['a', 'b', 'c', 'd'].map(memory);
    const layouts = layoutEngine.prepare(config, memories, 'c');
    const context = { config, memories, heroPhotoId: 'c', layouts };
    const expected = [
      [0, 'awakening'],
      [0.1, 'corridor'],
      [0.28, 'people'],
      [0.48, 'gather'],
      [0.7, 'hero'],
      [0.88, 'outro'],
      [1, 'outro'],
    ] as const;
    for (const [progress, phase] of expected) {
      expect(evaluateTemplateState(progress, context).phase.id).toBe(phase);
    }
    const later = evaluateTemplateState(0.75, context);
    const earlier = evaluateTemplateState(0.2, context);
    const back = evaluateTemplateState(0.4, context);
    expect(later.progress).toBe(0.75);
    expect(earlier.progress).toBe(0.2);
    expect(back.progress).toBe(0.4);
    expect(later.camera.position.every(Number.isFinite)).toBe(true);
  });
});
