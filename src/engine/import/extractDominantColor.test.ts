import { describe, expect, it } from 'vitest';

import { dominantColorFromRgb } from './extractDominantColor';

describe('dominant color normalization', () => {
  it('stores bounded RGB, HSL, luminance, and an algorithm version', () => {
    expect(dominantColorFromRgb([255.4, -2, 127.6])).toEqual({
      rgb: [255, 0, 128],
      hsl: [329.9, 100, 50],
      luminance: 0.2282,
      algorithmVersion: 1,
    });
  });
});
