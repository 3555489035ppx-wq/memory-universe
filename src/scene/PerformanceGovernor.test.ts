import { describe, expect, it } from 'vitest';

import { adjacentQuality, initialAutoQuality } from './performancePolicy';

describe('performance quality policy', () => {
  it('starts conservatively on constrained devices', () => {
    expect(initialAutoQuality(3, 16)).toBe('low');
    expect(initialAutoQuality(1, 4)).toBe('low');
    expect(initialAutoQuality(1, 16)).toBe('high');
    expect(initialAutoQuality(1.5, undefined)).toBe('medium');
  });

  it('moves one quality level at a time with bounded ends', () => {
    expect(adjacentQuality('high', 'down')).toBe('medium');
    expect(adjacentQuality('medium', 'up')).toBe('high');
    expect(adjacentQuality('low', 'down')).toBe('low');
  });
});
