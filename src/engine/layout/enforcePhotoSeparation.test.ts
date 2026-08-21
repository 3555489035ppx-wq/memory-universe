import { describe, expect, it } from 'vitest';

import { createMemoryFixture } from '../../test/fixtures/memoryFixture';
import { enforcePhotoSeparation, photoFootprint } from './enforcePhotoSeparation';

describe('photo separation', () => {
  it('deterministically separates photos that start at the same target', () => {
    const memories = Array.from({ length: 12 }, (_, index) => createMemoryFixture({
      id: `photo-${String(index).padStart(2, '0')}`,
      width: index % 3 === 0 ? 2400 : index % 3 === 1 ? 900 : 1600,
      height: index % 3 === 0 ? 800 : index % 3 === 1 ? 1800 : 1200,
    }));
    const positions = Object.fromEntries(memories.map((memory) => [memory.id, [0, 0, 0] as const]));
    const separated = enforcePhotoSeparation(positions, memories, { iterations: 16 });
    const reversed = enforcePhotoSeparation(positions, memories.toReversed(), { iterations: 16 });

    expect(separated).toEqual(reversed);
    for (let leftIndex = 0; leftIndex < memories.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < memories.length; rightIndex += 1) {
        const left = memories[leftIndex];
        const right = memories[rightIndex];
        if (!left || !right) continue;
        const leftPosition = separated[left.id];
        const rightPosition = separated[right.id];
        if (!leftPosition || !rightPosition) continue;
        const leftSize = photoFootprint(left);
        const rightSize = photoFootprint(right);
        const overlapX = (leftSize.width + rightSize.width) / 2 - Math.abs(leftPosition[0] - rightPosition[0]);
        const overlapY = (leftSize.height + rightSize.height) / 2 - Math.abs(leftPosition[1] - rightPosition[1]);
        expect(overlapX > 0 && overlapY > 0).toBe(false);
      }
    }
  });
});
