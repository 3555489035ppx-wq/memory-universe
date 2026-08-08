import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FallbackPlaybackClock } from './FallbackPlaybackClock';
import { MediaElementPlaybackClock } from './MediaElementPlaybackClock';

describe('playback clocks', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('fallback clock clamps random seeks and reports completion', () => {
    const clock = new FallbackPlaybackClock(10);
    const listener = vi.fn();
    const unsubscribe = clock.subscribe(listener);

    clock.seek(2);
    expect(clock.getSnapshot()).toMatchObject({ progress: 1, currentTime: 10, status: 'completed' });
    clock.seek(-1);
    expect(clock.getSnapshot()).toMatchObject({ progress: 0, currentTime: 0 });

    unsubscribe();
    clock.dispose();
    expect(listener).toHaveBeenCalled();
  });

  it('media clock maps duration and clamps seek without creating another audio element', () => {
    const audio = document.createElement('audio');
    Object.defineProperty(audio, 'duration', { configurable: true, value: 20 });
    Object.defineProperty(audio, 'currentTime', { configurable: true, writable: true, value: 5 });
    Object.defineProperty(audio, 'paused', { configurable: true, value: true });
    const clock = new MediaElementPlaybackClock(audio, 48);

    expect(clock.getSnapshot()).toMatchObject({ progress: 0.25, currentTime: 5, duration: 20, status: 'paused' });
    clock.seek(2);
    expect(audio.currentTime).toBe(20);
    clock.seek(-1);
    expect(audio.currentTime).toBe(0);
    clock.dispose();
  });
});
