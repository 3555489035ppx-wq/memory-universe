import { describe, expect, it } from 'vitest';

import { ContinuousTimelineProgress } from './ContinuousTimelineProgress';

describe('continuous timeline progress', () => {
  it('projects sparse playback samples into continuous forward motion', () => {
    const progress = new ContinuousTimelineProgress(0, 1 / 48, 0);
    progress.sync(0, true, 0);

    const beforeFirstMediaEvent = progress.advance(0.12, 0.12);
    progress.sync(0.005, true, 0.25);
    const betweenMediaEvents = progress.advance(0.38, 0.13);

    expect(beforeFirstMediaEvent).toBeGreaterThan(0);
    expect(betweenMediaEvents).toBeGreaterThan(0.005);
    expect(betweenMediaEvents).toBeLessThan(0.012);
  });

  it('honours pause and direct seeking immediately', () => {
    const progress = new ContinuousTimelineProgress(0.2, 1 / 48, 0);
    progress.sync(0.2, true, 0);
    progress.advance(0.2, 0.2);
    progress.sync(0.2, false, 0.2);
    expect(progress.advance(0.8, 0.6)).toBe(0.2);

    progress.sync(0.78, true, 0.8);
    expect(progress.value).toBe(0.78);
  });

  it('does not reverse visual time for a small out-of-order playback sample', () => {
    const progress = new ContinuousTimelineProgress(0.4, 1 / 180, 0);
    progress.sync(0.4, true, 0);
    progress.advance(0.2, 0.2);
    progress.sync(0.401, true, 0.5);
    const beforeJitter = progress.advance(0.6, 0.1);
    progress.sync(0.395, true, 0.7);
    const afterJitter = progress.advance(0.8, 0.1);

    expect(afterJitter).toBeGreaterThanOrEqual(beforeJitter - 0.0001);
  });
});
