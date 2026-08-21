import { describe, expect, it } from 'vitest';

import type { Memory } from '../../domain/memory';
import { selectTemplateMemoryIds } from './selectTemplateMemoryIds';

function memory(id: string, capturedAtMs: number, source: Memory['source'] = 'demo'): Memory {
  return {
    id,
    source,
    title: id,
    description: '',
    capturedAt: null,
    capturedAtMs,
    dateSource: 'manual',
    personIds: [],
    placeId: null,
    mood: null,
    tags: [],
    dominantColor: { rgb: [0, 0, 0], hsl: [0, 0, 0], luminance: 0, algorithmVersion: 1 },
    assetKeys: { micro: id, thumbnail: id, preview: id },
    width: 1200,
    height: 800,
    orientationApplied: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    schemaVersion: 1,
  };
}

describe('selectTemplateMemoryIds', () => {
  it('keeps every valid Demo photo eligible for the cinematic template', () => {
    const ids = selectTemplateMemoryIds([
      memory('demo-memory-026', 3),
      memory('demo-memory-025', 2),
      memory('demo-memory-024', 1),
    ], 80);

    expect(ids).toEqual(['demo-memory-024', 'demo-memory-025', 'demo-memory-026']);
    expect(selectTemplateMemoryIds([memory('demo-memory-025', 1, 'personal')], 80)).toEqual([
      'demo-memory-025',
    ]);
  });

  it('samples a long archive chronologically without duplicates', () => {
    const memories = Array.from({ length: 12 }, (_, index) => memory(`memory-${String(index)}`, index));
    const ids = selectTemplateMemoryIds(memories, 5);

    expect(ids).toHaveLength(5);
    expect(new Set(ids).size).toBe(5);
    expect(ids).toEqual(['memory-0', 'memory-3', 'memory-6', 'memory-8', 'memory-11']);
  });
});
