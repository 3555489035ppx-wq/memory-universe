import { describe, expect, it } from 'vitest';

import { applyPhotoExitTransform, crossfadeDurationSeconds, lifecycleOpacity } from './PhotoLifecycle';

describe('photo lifecycle', () => {
  it('keeps an exiting photo readable before a monotonic dissolve', () => {
    const samples = Array.from({ length: 101 }, (_, index) => lifecycleOpacity('exiting', index / 100));
    expect(samples[5]).toBe(1);
    expect(samples[50]).toBeGreaterThan(0.2);
    expect(samples[50]).toBeLessThan(0.8);
    expect(samples[90]).toBeLessThan(0.1);
    expect(samples.at(-1)).toBe(0);
    for (let index = 1; index < samples.length; index += 1) {
      expect(samples[index] ?? 0).toBeLessThanOrEqual((samples[index - 1] ?? 0) + 1e-9);
    }
  });

  it('uses a readable, bounded chapter crossfade window', () => {
    expect(crossfadeDurationSeconds(7)).toBeGreaterThan(1.5);
    expect(crossfadeDurationSeconds(7)).toBeLessThanOrEqual(2.25);
    expect(crossfadeDurationSeconds(0.2)).toBeGreaterThanOrEqual(1.55);
  });

  it('keeps entering photos faintly present before the full fade-in', () => {
    expect(lifecycleOpacity('entering', 0)).toBeCloseTo(0.14, 5);
    expect(lifecycleOpacity('entering', 0.5)).toBeGreaterThan(0.35);
    expect(lifecycleOpacity('entering', 1)).toBe(1);
  });

  it('retreats deterministically without collapsing the photo', () => {
    const transform = {
      position: [1, 2, 3] as const,
      rotation: [0, 0, 0] as const,
      scale: 1,
      opacity: 0.9,
    };
    const first = applyPhotoExitTransform(transform, 0.8, 'memory-1', 42);
    const second = applyPhotoExitTransform(transform, 0.8, 'memory-1', 42);
    expect(first).toEqual(second);
    expect(first.position[2]).toBeLessThan(transform.position[2]);
    expect(first.scale).toBeGreaterThan(0.95);
    expect(first.opacity).toBeGreaterThan(0);
  });
});
