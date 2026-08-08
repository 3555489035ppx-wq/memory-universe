import { describe, expect, it } from 'vitest';

import { containDimensions } from './deriveImages';

describe('derived image dimensions', () => {
  it('contains landscape and portrait images without enlarging small sources', () => {
    expect(containDimensions(4000, 2000, 1600)).toEqual([1600, 800]);
    expect(containDimensions(2000, 4000, 512)).toEqual([256, 512]);
    expect(containDimensions(40, 30, 64)).toEqual([40, 30]);
  });
});
