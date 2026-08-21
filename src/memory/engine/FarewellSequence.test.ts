import { describe, expect, it } from 'vitest';

import { evaluateFarewellSequence, FAREWELL_DURATION_SECONDS, FAREWELL_TEXT } from './FarewellSequence';

describe('farewell sequence', () => {
  it('reserves the final 6.8 seconds and follows the authored stage order', () => {
    const duration = 180;
    expect(evaluateFarewellSequence(duration - FAREWELL_DURATION_SECONDS - 0.01, duration).stage).toBe('idle');
    expect(evaluateFarewellSequence(duration - 6.4, duration).stage).toBe('preparing');
    expect(evaluateFarewellSequence(duration - 5, duration).stage).toBe('dissolving');
    expect(evaluateFarewellSequence(duration - 3.7, duration).stage).toBe('gathering');
    expect(evaluateFarewellSequence(duration - 2.2, duration).stage).toBe('text-hold');
    expect(evaluateFarewellSequence(duration - 0.5, duration).stage).toBe('tail');
  });

  it('holds the farewell copy legibly before the final fade', () => {
    const duration = 180;
    const visibleSamples = Array.from({ length: 21 }, (_, index) =>
      evaluateFarewellSequence(duration - 4.1 + index * 0.1, duration).particleTextOpacity,
    );
    expect(FAREWELL_TEXT).toBe('\u518D\u89C1\u4E86\uFF0C\u6211\u4EEC\u7684\u9752\u6625');
    expect(visibleSamples.filter((opacity) => opacity > 0.95).length).toBeGreaterThanOrEqual(14);
    expect(evaluateFarewellSequence(duration, duration).particleTextOpacity).toBe(0);
  });

  it('keeps reduced motion deterministic while lowering particle travel', () => {
    const full = evaluateFarewellSequence(176.5, 180, false);
    const reduced = evaluateFarewellSequence(176.5, 180, true);
    expect(reduced.particleGather).toBeLessThan(full.particleGather);
    expect(reduced.particleOpacity).toBeLessThan(full.particleOpacity);
    expect(reduced.particleTextOpacity).toBe(full.particleTextOpacity);
  });

  it('forms the particle copy before releasing it into the starfield', () => {
    const gathering = evaluateFarewellSequence(176.6, 180, false);
    const held = evaluateFarewellSequence(177.4, 180, false);
    const burst = evaluateFarewellSequence(179.6, 180, false);
    expect(gathering.particleTextOpacity).toBeGreaterThan(0);
    expect(held.particleTextOpacity).toBeGreaterThan(0.95);
    expect(held.particleExplosion).toBe(0);
    expect(burst.particleExplosion).toBeGreaterThan(0);
    expect(burst.particleOpacity).toBeLessThan(held.particleOpacity);
  });
});
