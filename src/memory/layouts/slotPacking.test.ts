import { describe, expect, it } from 'vitest';

import type { Memory } from '../../domain/memory';
import { packJustifiedPhotoRows } from './slotPacking';

function memory(id: string, width: number, height: number): Memory {
  return {
    id,
    source: 'demo',
    title: id,
    description: '',
    capturedAt: '2024-01-01',
    capturedAtMs: Date.UTC(2024, 0, 1),
    dateSource: 'manual',
    personIds: [],
    placeId: null,
    mood: null,
    tags: [],
    dominantColor: { rgb: [80, 100, 120], hsl: [210, 20, 40], luminance: 0.35, algorithmVersion: 1 },
    assetKeys: { micro: id, thumbnail: id, preview: id },
    width,
    height,
    orientationApplied: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    schemaVersion: 1,
  };
}

describe('packJustifiedPhotoRows', () => {
  const fixtures = Array.from({ length: 40 }, (_, index) => {
    const ratios = [
      [1, 1],
      [3, 1],
      [1, 3],
      [9, 16],
      [16, 9],
    ] as const;
    const [width, height] = ratios[index % ratios.length] ?? [1, 1];
    return memory(`memory-${String(index).padStart(2, '0')}`, width * 600, height * 600);
  });

  it('packs mixed aspect ratios inside the safe frame without overlap', () => {
    const slots = Object.values(packJustifiedPhotoRows(fixtures));
    expect(slots).toHaveLength(fixtures.length);

    for (const slot of slots) {
      expect(Math.abs(slot.position[0]) + slot.width / 2).toBeLessThanOrEqual(5.3 + 1e-6);
      expect(Math.abs(slot.position[1]) + slot.height / 2).toBeLessThanOrEqual(2.675 + 1e-6);
    }

    for (let leftIndex = 0; leftIndex < slots.length; leftIndex += 1) {
      const left = slots[leftIndex];
      if (!left) continue;
      for (let rightIndex = leftIndex + 1; rightIndex < slots.length; rightIndex += 1) {
        const right = slots[rightIndex];
        if (!right) continue;
        const separatedX = Math.abs(left.position[0] - right.position[0]) >= (left.width + right.width) / 2 - 1e-6;
        const separatedY = Math.abs(left.position[1] - right.position[1]) >= (left.height + right.height) / 2 - 1e-6;
        expect(separatedX || separatedY).toBe(true);
      }
    }
  });

  it('is deterministic regardless of input order', () => {
    expect(packJustifiedPhotoRows(fixtures)).toEqual(packJustifiedPhotoRows([...fixtures].reverse()));
  });

  it('never creates a one-photo final row', () => {
    const small = fixtures.slice(0, 13);
    const slots = Object.values(packJustifiedPhotoRows(small));
    const counts = new Map<number, number>();
    for (const slot of slots) counts.set(slot.row, (counts.get(slot.row) ?? 0) + 1);
    expect([...counts.values()].every((count) => count > 1)).toBe(true);
  });
});
