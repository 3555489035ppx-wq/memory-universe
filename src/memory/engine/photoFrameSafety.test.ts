import { describe, expect, it } from 'vitest';

import {
  blendPhotoFrameSafetyOffsets,
  hasMeaningfulPhotoFrameSafetyOffsets,
} from './photoFrameSafety';

describe('photo frame safety transition offsets', () => {
  it('releases collision offsets continuously instead of snapping at a phase boundary', () => {
    const applied = new Map([
      ['photo-1', { x: 0.6, y: -0.3, z: 0.2, scaleMultiplier: 0.94 }],
    ]);

    const released = blendPhotoFrameSafetyOffsets(applied, new Map(), 1 - Math.exp(-12 / 60));
    const releasedOffset = released.get('photo-1');

    expect(releasedOffset).toBeDefined();
    expect(releasedOffset?.x).toBeGreaterThan(0.45);
    expect(releasedOffset?.y).toBeLessThan(-0.2);
    expect(hasMeaningfulPhotoFrameSafetyOffsets(released)).toBe(true);
    expect(hasMeaningfulPhotoFrameSafetyOffsets(
      blendPhotoFrameSafetyOffsets(released, new Map(), 1),
    )).toBe(false);
  });
});
