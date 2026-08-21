import { describe, expect, it } from 'vitest';

import { TEMPLATE_VISIBLE_LIMITS, visiblePhotoLimit } from './templatePerformancePolicy';

describe('template performance policy', () => {
  it('keeps the desktop high-quality template visually dense', () => {
    expect(TEMPLATE_VISIBLE_LIMITS.high).toBe(96);
    expect(visiblePhotoLimit('high', 96)).toBe(96);
  });

  it('still caps lower quality modes before the requested count', () => {
    expect(visiblePhotoLimit('medium', 80)).toBe(60);
    expect(visiblePhotoLimit('low', 80)).toBe(36);
    expect(visiblePhotoLimit('high', 12)).toBe(12);
  });
});
