import { describe, expect, it } from 'vitest';

import type { Memory } from '../../domain/memory';
import { getMemoryTemplate } from '../config';
import { layoutEngine } from './LayoutEngine';
import { crossfadeDurationSeconds } from './PhotoLifecycle';
import { evaluatePhotoState, evaluateTemplateState } from './TimelineEngine';

function memory(id: string): Memory {
  return {
    id,
    source: 'demo',
    title: id,
    description: '',
    capturedAt: null,
    capturedAtMs: null,
    dateSource: 'unknown',
    personIds: [],
    placeId: null,
    mood: null,
    tags: [],
    dominantColor: { rgb: [100, 100, 100], hsl: [0, 0, 40], luminance: 0.3, algorithmVersion: 1 },
    assetKeys: { micro: `micro-${id}`, thumbnail: `thumb-${id}`, preview: `preview-${id}` },
    width: 900,
    height: 900,
    orientationApplied: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    schemaVersion: 1,
  };
}

describe('template timeline engine', () => {
  it('supports random access and exact high-school phase boundaries', () => {
    const config = getMemoryTemplate('high-school');
    const memories = ['a', 'b', 'c', 'd'].map(memory);
    const layouts = layoutEngine.prepare(config, memories, 'c');
    const context = { config, memories, heroPhotoId: 'c', layouts };
    const expected = [
      [0, 'hook'],
      [0.067, 'establish'],
      [0.167, 'memory-a'],
      [0.3, 'relationship'],
      [0.417, 'midpoint'],
      [0.5, 'chapter-b'],
      [0.617, 'acceleration'],
      [0.733, 'hero'],
      [0.85, 'closing'],
      [0.933, 'end-frame'],
      [1, 'end-frame'],
    ] as const;
    for (const [progress, phase] of expected) {
      expect(evaluateTemplateState(progress, context).phase.id).toBe(phase);
    }
    const later = evaluateTemplateState(0.75, context);
    const earlier = evaluateTemplateState(0.2, context);
    const back = evaluateTemplateState(0.4, context);
    expect(later.progress).toBe(0.75);
    expect(earlier.progress).toBe(0.2);
    expect(back.progress).toBe(0.4);
    expect(later.camera.position.every(Number.isFinite)).toBe(true);
  });

  it('keeps each short-form shot focused on a bounded photo window', () => {
    const config = getMemoryTemplate('high-school');
    const memories = Array.from({ length: 80 }, (_, index) => memory(`memory-${String(index)}`));
    const heroPhotoId = memories[40]?.id ?? null;
    const layouts = layoutEngine.prepare(config, memories, heroPhotoId);
    const context = { config, memories, heroPhotoId, layouts };
    const establish = evaluateTemplateState(0.12, context);
    const hero = evaluateTemplateState(0.8, context);

    expect(establish.photos.filter((photo) => photo.transform.opacity > 0.01)).toHaveLength(14);
    expect(hero.photos.filter((photo) => photo.transform.opacity > 0.01).length).toBeLessThanOrEqual(11);
  });

  it('renders an immediately visible opening frame while preview is paused at zero', () => {
    const config = getMemoryTemplate('high-school');
    const memories = Array.from({ length: 24 }, (_, index) => memory(`memory-${String(index)}`));
    const heroPhotoId = memories[12]?.id ?? null;
    const layouts = layoutEngine.prepare(config, memories, heroPhotoId);
    const frame = evaluateTemplateState(0, { config, memories, heroPhotoId, layouts });

    expect(frame.photos.some((photo) => photo.transform.opacity > 0.5)).toBe(true);
  });

  it('evaluates one photo identically to the full timeline frame', () => {
    const config = getMemoryTemplate('love');
    const memories = ['a', 'b', 'c', 'd'].map(memory);
    const layouts = layoutEngine.prepare(config, memories, 'c');
    const context = { config, memories, heroPhotoId: 'c', layouts };
    const fullFrame = evaluateTemplateState(0.63, context);
    const targetMemory = memories[2];
    if (!targetMemory) throw new Error('Expected a third memory for timeline comparison');
    const singlePhoto = evaluatePhotoState(0.63, context, targetMemory, 2);

    expect(singlePhoto).toEqual(fullFrame.photos[2]);
  });

  it('retains an outgoing photo through a deterministic visible exit', () => {
    const config = getMemoryTemplate('high-school');
    const memories = Array.from({ length: 80 }, (_, index) => memory(`memory-${String(index)}`));
    const layouts = layoutEngine.prepare(config, memories, memories[40]?.id ?? null);
    const context = { config, memories, heroPhotoId: memories[40]?.id ?? null, layouts };
    const outgoing = memories[0];
    if (!outgoing) throw new Error('Expected an outgoing fixture memory.');
    const transitionPhase = config.phases.find((phase) => phase.id === 'memory-a');
    if (!transitionPhase) throw new Error('Expected the memory-a transition phase.');
    const phaseSeconds = (transitionPhase.end - transitionPhase.start) * config.durationSeconds;
    const releasedProgress = transitionPhase.start
      + (crossfadeDurationSeconds(phaseSeconds) + 0.8) / config.durationSeconds;

    const boundary = evaluatePhotoState(0.167, context, outgoing, 0);
    const dissolving = evaluatePhotoState(0.1695, context, outgoing, 0);
    const released = evaluatePhotoState(releasedProgress, context, outgoing, 0);

    expect(boundary?.lifecycle.stage).toBe('exiting');
    expect(boundary?.transform.opacity).toBeGreaterThan(0.8);
    expect(dissolving?.transform.opacity).toBeLessThanOrEqual(boundary?.transform.opacity ?? 0);
    expect(released?.lifecycle.removable).toBe(true);
    expect(released?.transform.opacity).toBe(0);
  });

  it('uses a dissolve-only trajectory when reduced motion is enabled', () => {
    const config = getMemoryTemplate('high-school');
    const memories = Array.from({ length: 24 }, (_, index) => memory(`memory-${String(index)}`));
    const heroPhotoId = memories[12]?.id ?? null;
    const layouts = layoutEngine.prepare(config, memories, heroPhotoId);
    const full = evaluateTemplateState(0.22, { config, memories, heroPhotoId, layouts });
    const reduced = evaluateTemplateState(0.22, { config, memories, heroPhotoId, layouts, reducedMotion: true });

    expect(reduced.photos.some((photo, index) =>
      JSON.stringify(photo.transform.position) !== JSON.stringify(full.photos[index]?.transform.position),
    )).toBe(true);
    expect(reduced.photos.map((photo) => photo.lifecycle)).toEqual(full.photos.map((photo) => photo.lifecycle));
  });
});
