import { describe, expect, it } from 'vitest';

import { selectMemoryLod, textureVariantForLod } from './lodPolicy';

describe('LOD policy', () => {
  it('uses hysteresis instead of oscillating at a detail boundary', () => {
    expect(selectMemoryLod(9.6, 'medium', false, 'medium')).toBe('medium');
    expect(selectMemoryLod(8.7, 'medium', false, 'medium')).toBe('near');
    expect(selectMemoryLod(10.8, 'near', false, 'medium')).toBe('near');
    expect(selectMemoryLod(11.3, 'near', false, 'medium')).toBe('medium');
  });

  it('always reserves preview for focus and removes far textures', () => {
    expect(selectMemoryLod(100, 'far', true, 'low')).toBe('focus');
    expect(textureVariantForLod('focus')).toBe('preview');
    expect(textureVariantForLod('far')).toBeNull();
  });

  it('reduces detail distance on low quality', () => {
    expect(selectMemoryLod(9, 'far', false, 'high')).toBe('near');
    expect(selectMemoryLod(9, 'far', false, 'low')).toBe('medium');
  });
});
