import { describe, expect, it } from 'vitest';

import { DEMO_MUSIC_TRACKS, HIGH_SCHOOL_DEMO_TRACK } from './demoMusic';

describe('bundled Demo music', () => {
  it('uses the user-owned track as the high-school background and keeps safe alternatives', () => {
    expect(DEMO_MUSIC_TRACKS).toHaveLength(3);
    expect(HIGH_SCHOOL_DEMO_TRACK.name).toBe('特别的人');
    expect(HIGH_SCHOOL_DEMO_TRACK.src).toContain('/music/high-school/te-bie-de-ren-fang-datong.mp3');
    expect(DEMO_MUSIC_TRACKS.every((track) => track.source === 'system')).toBe(true);
  });
});
