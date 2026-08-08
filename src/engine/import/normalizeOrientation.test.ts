import { describe, expect, it } from 'vitest';

import { orientationTransform, orientedDimensions } from './normalizeOrientation';

describe('EXIF orientation normalization', () => {
  it('swaps output dimensions only for transposed orientations', () => {
    expect(orientedDimensions(1200, 800, 1)).toEqual([1200, 800]);
    expect(orientedDimensions(1200, 800, 3)).toEqual([1200, 800]);
    expect(orientedDimensions(1200, 800, 6)).toEqual([800, 1200]);
    expect(orientedDimensions(1200, 800, 8)).toEqual([800, 1200]);
  });

  it('provides stable affine transforms for every EXIF orientation', () => {
    expect(Array.from({ length: 8 }, (_, index) => orientationTransform(1200, 800, index + 1))).toEqual([
      [1, 0, 0, 1, 0, 0],
      [-1, 0, 0, 1, 1200, 0],
      [-1, 0, 0, -1, 1200, 800],
      [1, 0, 0, -1, 0, 800],
      [0, 1, 1, 0, 0, 0],
      [0, 1, -1, 0, 800, 0],
      [0, -1, -1, 0, 800, 1200],
      [0, -1, 1, 0, 0, 1200],
    ]);
  });
});
