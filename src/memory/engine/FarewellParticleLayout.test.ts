import { describe, expect, it } from 'vitest';

import { createFarewellTextTargets } from './FarewellParticleLayout';

describe('farewell particle typography layout', () => {
  it('produces a finite, wide and readable target cloud at export density', () => {
    const targets = createFarewellTextTargets(2_400, 7_431);
    expect(targets).toHaveLength(7_200);

    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (let index = 0; index < targets.length; index += 3) {
      const x = targets[index] ?? 0;
      const y = targets[index + 1] ?? 0;
      expect(Number.isFinite(x)).toBe(true);
      expect(Number.isFinite(y)).toBe(true);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }

    expect(maxX - minX).toBeGreaterThan(5);
    expect(maxY - minY).toBeGreaterThan(1);
  });
});
