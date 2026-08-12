import { describe, expect, it } from 'vitest';

import type { Memory } from '../../domain/memory';
import { highSchoolTemplate } from '../config/high-school';
import { layoutEngine } from './LayoutEngine';
import { buildSongTimelineConfig } from './SongTimeline';
import { composePhaseLayouts, compositionBounds, compositionContinuityDiagnostics } from './composePhaseLayouts';
import { applyPhotoFrameSafetyOffsets, createPhotoFrameSafetyOffsets } from './photoFrameSafety';
import {
  createTimelineFrame,
  evaluatePhotoStateAtFrame,
  evaluateTemplateState,
  isPhotoInPhaseWindow,
} from './TimelineEngine';
import { dimensions } from '../layouts/shared';

function memory(id: string, index: number): Memory {
  return {
    id,
    source: 'demo',
    title: id,
    description: '',
    capturedAt: `2024-01-${String(index + 1).padStart(2, '0')}`,
    capturedAtMs: Date.UTC(2024, 0, index + 1),
    dateSource: 'manual',
    personIds: [],
    placeId: null,
    mood: null,
    tags: [],
    dominantColor: { rgb: [100, 100, 100], hsl: [0, 0, 40], luminance: 0.3, algorithmVersion: 1 },
    assetKeys: { micro: `micro-${id}`, thumbnail: `thumb-${id}`, preview: `preview-${id}` },
    width: index % 3 === 0 ? 900 : 1600,
    height: index % 3 === 0 ? 1600 : 1067,
    orientationApplied: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    schemaVersion: 1,
  };
}

function span(values: number[]): number {
  return Math.max(...values) - Math.min(...values);
}

function overlapCount(
  photos: ReturnType<typeof evaluateTemplateState>['photos'],
): number {
  let count = 0;
  for (let leftIndex = 0; leftIndex < photos.length; leftIndex += 1) {
    const left = photos[leftIndex];
    if (!left || left.transform.opacity < 0.45) continue;
    const [leftWidth, leftHeight] = dimensions(left.memory);
    const leftHalfWidth = leftWidth * left.transform.scale * 0.5;
    const leftHalfHeight = leftHeight * left.transform.scale * 0.5;
    for (let rightIndex = leftIndex + 1; rightIndex < photos.length; rightIndex += 1) {
      const right = photos[rightIndex];
      if (!right || right.transform.opacity < 0.45) continue;
      const [rightWidth, rightHeight] = dimensions(right.memory);
      const rightHalfWidth = rightWidth * right.transform.scale * 0.5;
      const rightHalfHeight = rightHeight * right.transform.scale * 0.5;
      const overlapX = leftHalfWidth + rightHalfWidth - Math.abs(left.transform.position[0] - right.transform.position[0]);
      const overlapY = leftHalfHeight + rightHalfHeight - Math.abs(left.transform.position[1] - right.transform.position[1]);
      if (overlapX > 0.025 && overlapY > 0.025) count += 1;
    }
  }
  return count;
}

function connectedComponentCount(
  photos: ReturnType<typeof evaluateTemplateState>['photos'],
): number {
  const visible = photos.filter((photo) => photo.transform.opacity >= 0.45);
  if (visible.length <= 1) return visible.length;
  const visited = new Set<string>();
  let components = 0;
  for (const root of visible) {
    if (visited.has(root.memory.id)) continue;
    components += 1;
    const queue = [root];
    visited.add(root.memory.id);
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) continue;
      const [currentWidth, currentHeight] = dimensions(current.memory);
      const currentReach = Math.max(currentWidth, currentHeight) * current.transform.scale * 1.8 + 0.48;
      for (const candidate of visible) {
        if (visited.has(candidate.memory.id)) continue;
        const distance = Math.hypot(
          candidate.transform.position[0] - current.transform.position[0],
          candidate.transform.position[1] - current.transform.position[1],
        );
        const [candidateWidth, candidateHeight] = dimensions(candidate.memory);
        const candidateReach = Math.max(candidateWidth, candidateHeight) * candidate.transform.scale * 1.8 + 0.48;
        if (distance <= Math.max(currentReach, candidateReach)) {
          visited.add(candidate.memory.id);
          queue.push(candidate);
        }
      }
    }
  }
  return components;
}

describe('photo composition density regression', () => {
  const memories = Array.from({ length: 96 }, (_, index) => memory(`memory-${String(index)}`, index));
  const config = buildSongTimelineConfig(highSchoolTemplate, 52);
  const layouts = layoutEngine.prepare(config, memories, memories[48]?.id ?? null);

  it('fills the active frame instead of using only a sparse slice of the full layout', () => {
    const phase = config.phases.find((candidate) => candidate.layout === 'mosaic' && (candidate.visibleCount ?? 0) >= 40);
    if (!phase) throw new Error('Expected a dense mosaic phase.');
    const progress = (phase.start + phase.end) / 2;
    const frame = evaluateTemplateState(progress, {
      config,
      memories,
      heroPhotoId: memories[48]?.id ?? null,
      layouts,
      phaseLayouts: composePhaseLayouts(config, memories, layouts, memories[48]?.id ?? null),
    });
    const positions = frame.photos
      .filter((photo, index) => photo.transform.opacity > 0.01 && isPhotoInPhaseWindow(index, memories.length, phase))
      .map((photo) => photo.transform.position);
    const xSpan = span(positions.map(([x]) => x));
    const ySpan = span(positions.map(([, y]) => y));

    expect(positions.length).toBeGreaterThanOrEqual(40);
    expect(xSpan).toBeGreaterThan(7.5);
    expect(ySpan).toBeGreaterThan(3.2);
  });

  it('reflows the same phase into a visible portrait-safe frame', () => {
    const phase = config.phases.find((candidate) => candidate.layout === 'mosaic' && (candidate.visibleCount ?? 0) >= 40);
    if (!phase) throw new Error('Expected a dense mosaic phase.');
    const portraitAspect = 9 / 16;
    const frame = evaluateTemplateState((phase.start + phase.end) / 2, {
      config,
      memories,
      heroPhotoId: memories[48]?.id ?? null,
      layouts,
      phaseLayouts: composePhaseLayouts(config, memories, layouts, memories[48]?.id ?? null, { aspect: portraitAspect }),
    });
    const positions = frame.photos
      .filter((photo, index) => photo.transform.opacity > 0.01 && isPhotoInPhaseWindow(index, memories.length, phase))
      .map((photo) => photo.transform.position);
    const bounds = compositionBounds(portraitAspect);

    expect(positions.length).toBeGreaterThanOrEqual(40);
    expect(span(positions.map(([x]) => x))).toBeLessThanOrEqual(bounds.maxWidth + 0.1);
    expect(span(positions.map(([, y]) => y))).toBeLessThanOrEqual(bounds.maxHeight + 0.1);
  });

  it('never opens on an isolated hero photo', () => {
    const phase = config.phases[0];
    if (!phase) throw new Error('Expected an opening phase.');
    const frame = evaluateTemplateState(0, {
      config,
      memories,
      heroPhotoId: memories[48]?.id ?? null,
      layouts,
      phaseLayouts: composePhaseLayouts(config, memories, layouts, memories[48]?.id ?? null, { aspect: 9 / 16 }),
    });
    const visible = frame.photos.filter((photo) => photo.transform.opacity > 0.08);
    expect(visible).toHaveLength(1);
    expect(visible[0]?.memory.id).toBe(memories[48]?.id);
    expect(visible[0]?.transform.scale ?? 0).toBeGreaterThan(1.2);
  });

  it('keeps every non-grid chapter connected instead of leaving islands', () => {
    const phaseLayouts = composePhaseLayouts(config, memories, layouts, memories[48]?.id ?? null);
    const chapters = config.phases.filter((phase) => phase.layout !== 'mosaic' && (phase.visibleCount ?? 0) >= 38);
    for (const phase of chapters) {
      const active = memories.filter((_, index) => isPhotoInPhaseWindow(index, memories.length, phase));
      const diagnostics = compositionContinuityDiagnostics(active, phaseLayouts[phase.id] ?? {});
      expect(diagnostics.isolatedCount, `${phase.id} should have no isolated photos`).toBe(0);
      expect(diagnostics.maxNearestDistance, `${phase.id} should not have a large empty gap`).toBeLessThan(2.5);
    }
  });

  it('keeps the moving photos separated and in one connected visual mass', () => {
    const phaseLayouts = composePhaseLayouts(config, memories, layouts, memories[48]?.id ?? null);
    const context = {
      config,
      memories,
      heroPhotoId: memories[48]?.id ?? null,
      layouts,
      phaseLayouts,
    };
    const phases = config.phases.filter((phase) => (
      phase.layout !== 'spotlight'
      && phase.id !== 'song-ending'
      && (phase.visibleCount ?? 0) >= 38
    ));
    for (const phase of phases) {
      for (const local of [0.32, 0.58, 0.82]) {
        const progress = phase.start + (phase.end - phase.start) * local;
        const state = evaluateTemplateState(progress, context);
        const active = state.photos.filter((photo, index) => (
          isPhotoInPhaseWindow(index, memories.length, phase)
          && photo.transform.opacity >= 0.45
        ));
        expect(overlapCount(active), `${phase.id} at ${String(local)} should not overlap`).toBe(0);
        expect(connectedComponentCount(active), `${phase.id} (${phase.layout}/${phase.motion ?? 'none'}) at ${String(local)} should be one connected mass`).toBe(1);
      }
    }
  });

  it('keeps the desktop cascade chapter large enough to read after top-down framing', () => {
    const longConfig = buildSongTimelineConfig(highSchoolTemplate, 300);
    const longLayouts = layoutEngine.prepare(longConfig, memories, memories[48]?.id ?? null);
    const context = {
      config: longConfig,
      memories,
      heroPhotoId: memories[48]?.id ?? null,
      layouts: longLayouts,
      phaseLayouts: composePhaseLayouts(longConfig, memories, longLayouts, memories[48]?.id ?? null),
    };
    const phase = longConfig.phases.find((candidate) => candidate.motion === 'accordion-fold');
    if (!phase) throw new Error('Expected the desktop cascade chapter.');
    const state = evaluateTemplateState(phase.start + (phase.end - phase.start) * 0.58, context);
    const active = state.photos.filter((photo, index) => (
      isPhotoInPhaseWindow(index, memories.length, phase)
      && photo.transform.opacity >= 0.45
    ));
    expect(active.length).toBeGreaterThanOrEqual(30);
    expect(span(active.map((photo) => photo.transform.position[0]))).toBeGreaterThan(7);
    expect(span(active.map((photo) => photo.transform.position[1]))).toBeGreaterThan(3.4);
    expect(overlapCount(active)).toBe(0);
    expect(connectedComponentCount(active)).toBe(1);
  });

  it('keeps each photo-built 3D silhouette compact, connected, and collision-free', () => {
    const longConfig = buildSongTimelineConfig(highSchoolTemplate, 300);
    const longLayouts = layoutEngine.prepare(longConfig, memories, memories[48]?.id ?? null);
    const context = {
      config: longConfig,
      memories,
      heroPhotoId: memories[48]?.id ?? null,
      layouts: longLayouts,
      phaseLayouts: composePhaseLayouts(longConfig, memories, longLayouts, memories[48]?.id ?? null),
    };
    const geometricLayouts = new Set(['sphere', 'star', 'torus', 'prism']);
    for (const phase of longConfig.phases.filter((candidate) => geometricLayouts.has(candidate.layout))) {
      const state = evaluateTemplateState(phase.start + (phase.end - phase.start) * 0.58, context);
      const active = state.photos.filter((photo, index) => (
        isPhotoInPhaseWindow(index, memories.length, phase)
        && photo.transform.opacity >= 0.45
      ));
      expect(active.length, `${phase.id} should keep a readable 3D photo cast`).toBeGreaterThanOrEqual(30);
      expect(overlapCount(active), `${phase.id} should not stack photo cards`).toBe(0);
      expect(connectedComponentCount(active), `${phase.id} should remain one photo-built form`).toBe(1);
    }
  });

  it('never leaves readable transitional afterimages or detached islands during a full-song edit', () => {
    const longConfig = buildSongTimelineConfig(highSchoolTemplate, 300);
    const longLayouts = layoutEngine.prepare(longConfig, memories, memories[48]?.id ?? null);
    const context = {
      config: longConfig,
      memories,
      heroPhotoId: memories[48]?.id ?? null,
      layouts: longLayouts,
      phaseLayouts: composePhaseLayouts(longConfig, memories, longLayouts, memories[48]?.id ?? null),
    };
    for (const phase of longConfig.phases.slice(1, -1)) {
      // The first fraction is intentionally a material-level hand-off from the
      // previous scene. Once the incoming composition is readable, every
      // sampled state must be a single connected mass.
      for (const local of [0.2, 0.37, 0.56, 0.74, 0.91]) {
        const state = evaluateTemplateState(phase.start + (phase.end - phase.start) * local, context);
        const readable = state.photos.filter((photo, index) => (
          isPhotoInPhaseWindow(index, memories.length, phase)
          && photo.transform.opacity >= 0.1
        ));
        expect(overlapCount(readable), `${phase.id} at ${String(local)} should not overlap`).toBe(0);
        expect(connectedComponentCount(readable), `${phase.id} (${phase.layout}/${phase.motion ?? 'none'}) at ${String(local)} should not leave readable islands`).toBe(1);
      }
    }
  });

  it('keeps the actual render-loop photo subset collision-free without relying on the full-state safety pass', () => {
    const longConfig = buildSongTimelineConfig(highSchoolTemplate, 180);
    const longLayouts = layoutEngine.prepare(longConfig, memories, memories[48]?.id ?? null);
    const context = {
      config: longConfig,
      memories,
      heroPhotoId: memories[48]?.id ?? null,
      layouts: longLayouts,
      phaseLayouts: composePhaseLayouts(longConfig, memories, longLayouts, memories[48]?.id ?? null),
    };
    const geometry = new Set(['sphere', 'star', 'torus', 'prism']);

    for (const phase of longConfig.phases.filter((candidate) => geometry.has(candidate.layout))) {
      for (const local of [0.22, 0.46, 0.7, 0.9]) {
        const progress = phase.start + (phase.end - phase.start) * local;
        const frame = createTimelineFrame(progress, context);
        const rendered = memories.flatMap((item, memoryIndex) => {
          if (!isPhotoInPhaseWindow(memoryIndex, memories.length, phase)) return [];
          const photo = evaluatePhotoStateAtFrame(frame, context, item, memoryIndex);
          return photo ? [photo] : [];
        });
        const safeRendered = applyPhotoFrameSafetyOffsets(
          rendered,
          createPhotoFrameSafetyOffsets(rendered, {
            ...compositionBounds(),
            activeMemoryIds: rendered.map((photo) => photo.memory.id),
          }),
        );
        expect(overlapCount(safeRendered), `${phase.id} (${phase.layout}/${phase.motion ?? 'none'}) runtime subset at ${String(local)} should not overlap`).toBe(0);
        expect(connectedComponentCount(safeRendered), `${phase.id} (${phase.layout}/${phase.motion ?? 'none'}) runtime subset at ${String(local)} should remain connected`).toBe(1);
      }
    }
  });

  it('does not leave the rain-drop chapter as a tiny island in the desktop frame', () => {
    const longConfig = buildSongTimelineConfig(highSchoolTemplate, 231);
    const longLayouts = layoutEngine.prepare(longConfig, memories, memories[48]?.id ?? null);
    const context = {
      config: longConfig,
      memories,
      heroPhotoId: memories[48]?.id ?? null,
      layouts: longLayouts,
      phaseLayouts: composePhaseLayouts(longConfig, memories, longLayouts, memories[48]?.id ?? null, { aspect: 16 / 9 }),
    };
    const phase = longConfig.phases.find((candidate) => candidate.motion === 'rain-drop');
    if (!phase) throw new Error('Expected the rain-drop chapter.');
    const state = evaluateTemplateState(phase.start + (phase.end - phase.start) * 0.68, context);
    const active = state.photos.filter((photo, index) => (
      isPhotoInPhaseWindow(index, memories.length, phase)
      && photo.transform.opacity >= 0.45
    ));
    const xSpan = span(active.map((photo) => photo.transform.position[0]));
    const ySpan = span(active.map((photo) => photo.transform.position[1]));
    expect(xSpan, 'rain-drop should occupy the desktop width').toBeGreaterThan(6.2);
    expect(ySpan, 'rain-drop should occupy a visible desktop height').toBeGreaterThan(2.6);
  });
});
