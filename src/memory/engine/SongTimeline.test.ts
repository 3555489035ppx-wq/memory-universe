import { describe, expect, it } from 'vitest';

import { highSchoolTemplate } from '../config/high-school';
import { buildSongTimelineConfig, motionFamily, songTimelineProgress } from './SongTimeline';
import { isPhotoInPhaseWindow } from './TimelineEngine';

describe('song timeline', () => {
  it('uses the complete remaining song as its playback range', () => {
    expect(songTimelineProgress({ currentTime: 105, mediaDuration: 210, cueStart: 0 })).toBe(0.5);
    expect(songTimelineProgress({ currentTime: 210, mediaDuration: 210, cueStart: 0 })).toBe(1);
    expect(songTimelineProgress({ currentTime: 110, mediaDuration: 200, cueStart: 20 })).toBe(0.5);
  });

  it('adds scenes for a long song instead of stretching the short edit', () => {
    const config = buildSongTimelineConfig(highSchoolTemplate, 210);
    expect(config.durationSeconds).toBe(210);
    expect(config.phases.length).toBeGreaterThanOrEqual(40);
    expect(config.phases[0]?.start).toBe(0);
    expect(config.phases.at(-1)?.end).toBe(1);
    expect(new Set(config.phases.map((phase) => phase.layout)).size).toBeGreaterThanOrEqual(11);
  });

  it('rotates photo windows so the whole library participates', () => {
    const config = buildSongTimelineConfig(highSchoolTemplate, 180);
    const offsets = config.phases.map((phase) => phase.photoOffset ?? 0);
    expect(new Set(offsets).size).toBe(config.phases.length);
    expect(Math.max(...offsets)).toBeGreaterThan(80);
    for (let photoIndex = 0; photoIndex < 96; photoIndex += 1) {
      expect(
        config.phases.some((phase) => isPhotoInPhaseWindow(photoIndex, 96, phase)),
        `photo ${String(photoIndex)} should appear in at least one chapter`,
      ).toBe(true);
    }
  });

  it('keeps a long edit dense without over-repeating the same shot language', () => {
    const config = buildSongTimelineConfig(highSchoolTemplate, 210);
    const storyPhases = config.phases.slice(1, -1);
    const signatures = storyPhases.map((phase) => `${phase.layout}:${phase.camera}:${phase.motion ?? ''}`);
    const repeats = signatures.map((signature) => signatures.filter((candidate) => candidate === signature).length);
    const averageVisibleCount = storyPhases.reduce((total, phase) => total + (phase.visibleCount ?? 0), 0) / storyPhases.length;
    expect(Math.max(...repeats)).toBeLessThanOrEqual(2);
    expect(Math.min(...storyPhases.map((phase) => phase.visibleCount ?? 0))).toBeGreaterThanOrEqual(38);
    expect(averageVisibleCount).toBeGreaterThan(40);
  });

  it('keeps each chapter short and favors 3D silhouettes over grid-like blocks', () => {
    const config = buildSongTimelineConfig(highSchoolTemplate, 300);
    const storyPhases = config.phases.slice(1, -1);
    const gridLikeCount = storyPhases.filter((phase) => phase.layout === 'mosaic' || phase.layout === 'deck').length;
    const threeDimensionalCount = storyPhases.filter((phase) => (
      phase.layout === 'orbit'
      || phase.layout === 'galaxy'
      || phase.layout === 'helix'
      || phase.layout === 'tunnel'
      || phase.layout === 'ribbon'
      || phase.layout === 'gravity'
      || phase.layout === 'cascade'
      || phase.layout === 'scattered'
      || phase.layout === 'wave'
      || phase.layout === 'sphere'
      || phase.layout === 'star'
      || phase.layout === 'torus'
      || phase.layout === 'prism'
    )).length;
    const longestChapterSeconds = Math.max(
      ...config.phases.map((phase) => (phase.end - phase.start) * config.durationSeconds),
    );

    expect(longestChapterSeconds).toBeLessThan(10);
    expect(threeDimensionalCount / storyPhases.length).toBeGreaterThan(0.8);
    expect(gridLikeCount).toBeLessThanOrEqual(5);
  });

  it('uses the large hero only once and introduces distinct physical scenes', () => {
    const config = buildSongTimelineConfig(highSchoolTemplate, 210);
    expect(config.phases.filter((phase) => phase.layout === 'spotlight')).toHaveLength(1);
    expect(config.phases.filter((phase) => phase.motion === 'gravity-drop').length).toBeLessThanOrEqual(2);
    expect(config.phases[0]?.end).toBeLessThan(0.02);
    expect(config.phases.some((phase) => phase.motion === 'gravity-drop')).toBe(true);
    expect(config.phases.some((phase) => phase.motion === 'deck-shuffle')).toBe(true);
    expect(config.phases.some((phase) => phase.motion === 'depth-bloom')).toBe(true);
    expect(config.phases.some((phase) => phase.motion === 'wave-drift')).toBe(true);
    expect(config.phases.some((phase) => phase.motion === 'wave-surface')).toBe(true);
    expect(config.phases.some((phase) => phase.motion === 'film-rail')).toBe(true);
    expect(config.phases.some((phase) => phase.motion === 'accordion-fold')).toBe(true);
    expect(config.phases.some((phase) => phase.motion === 'magnetic-swap')).toBe(true);
    expect(config.phases.some((phase) => phase.motion === 'spiral-lift')).toBe(true);
    expect(config.phases.some((phase) => phase.layout === 'sphere')).toBe(true);
    expect(config.phases.some((phase) => phase.layout === 'star')).toBe(true);
    expect(config.phases.some((phase) => phase.layout === 'torus')).toBe(true);
    expect(config.phases.some((phase) => phase.layout === 'prism')).toBe(true);
  });

  it('spreads photo-built 3D feature chapters across the whole song', () => {
    const config = buildSongTimelineConfig(highSchoolTemplate, 300);
    const storyPhases = config.phases.slice(1, -1);
    const featuredMotions = ['sphere-pulse', 'torus-spin', 'star-ignite', 'cylinder-roll', 'prism-fold'];
    const featuredIndices = storyPhases
      .map((phase, index) => ({ phase, index }))
      .filter(({ phase }) => featuredMotions.includes(phase.motion ?? ''))
      .map(({ index }) => index);

    expect(featuredIndices).toHaveLength(5);
    expect(featuredIndices[0]).toBeLessThan(storyPhases.length * 0.3);
    expect(featuredIndices.at(-1) ?? 0).toBeGreaterThan(storyPhases.length * 0.65);
    for (let index = 1; index < featuredIndices.length; index += 1) {
      expect((featuredIndices[index] ?? 0) - (featuredIndices[index - 1] ?? 0)).toBeLessThan(storyPhases.length * 0.25);
    }
  });

  it('authors deterministic music cues with a bounded number of peak events', () => {
    const config = buildSongTimelineConfig(highSchoolTemplate, 210);
    const cues = config.motionCues ?? [];
    const openingMotions = config.phases
      .filter((phase) => phase.start * config.durationSeconds < 30)
      .map((phase) => phase.motion);

    expect(cues).toHaveLength(config.phases.length);
    expect(cues.at(-1)?.kind).toBe('farewell');
    expect(cues.filter((cue) => cue.strength === 2).length).toBeLessThanOrEqual(6);
    expect(new Set(openingMotions).size).toBeGreaterThanOrEqual(3);
    expect(buildSongTimelineConfig(highSchoolTemplate, 210).motionCues).toEqual(cues);
  });

  it('does not repeat a visual chapter during a five-minute song', () => {
    const config = buildSongTimelineConfig(highSchoolTemplate, 300);
    const storyPhases = config.phases.slice(1, -1);
    const signatures = storyPhases.map((phase) => `${phase.layout}:${phase.camera}:${phase.motion ?? ''}`);
    const allMotions = config.phases.map((phase) => phase.motion ?? '');
    expect(new Set(signatures).size).toBe(signatures.length);
    expect(new Set(allMotions).size).toBe(allMotions.length);
    for (let index = 1; index < storyPhases.length; index += 1) {
      expect(storyPhases[index]?.motion).not.toBe(storyPhases[index - 1]?.motion);
      if (index >= 2) expect(storyPhases[index]?.motion).not.toBe(storyPhases[index - 2]?.motion);
    }
    expect(config.phases[0]?.start).toBe(0);
    expect(config.phases.at(-1)?.end).toBe(1);
  });

  it('does not place adjacent chapters from the same visible motion family', () => {
    const config = buildSongTimelineConfig(highSchoolTemplate, 180);
    const storyPhases = config.phases.slice(1, -1);
    for (let index = 1; index < storyPhases.length; index += 1) {
      const previous = storyPhases[index - 1];
      const current = storyPhases[index];
      if (!previous || !current) continue;
      const label = `${String(index)}: ${previous.motion ?? 'none'} -> ${current.motion ?? 'none'}`;
      expect(motionFamily(current), label).not.toBe(motionFamily(previous));
      expect(current.layout, label).not.toBe(previous.layout);
    }
  });

  it('does not reuse a concrete motion during a three-minute song', () => {
    const config = buildSongTimelineConfig(highSchoolTemplate, 180);
    const motions = config.phases.map((phase) => phase.motion ?? '');
    expect(new Set(motions).size).toBe(motions.length);
  });
});
