import { describe, expect, it } from 'vitest';

import { choreographPhotoTransform } from './PhotoChoreography';

const transform = {
  position: [2, 1, -1] as [number, number, number],
  rotation: [0, 0, 0] as [number, number, number],
  scale: 0.8,
  opacity: 0.9,
};

describe('photo choreography', () => {
  it('returns to the authored layout at phase boundaries', () => {
    const input = {
      memoryId: 'memory-1', memoryIndex: 1, phase: { id: 'orbit', start: 0, end: 1, layout: 'orbit' as const, label: 'Orbit', camera: 'approach' as const }, seed: 42, emphasis: 'quiet' as const,
    };
    expect(choreographPhotoTransform(transform, { ...input, phaseProgress: 0 })).toBe(transform);
    expect(choreographPhotoTransform(transform, { ...input, phaseProgress: 1 })).toBe(transform);
  });

  it('adds visible but deterministic travel inside a phase', () => {
    const result = choreographPhotoTransform(transform, {
      memoryId: 'memory-1', memoryIndex: 1, phase: { id: 'orbit', start: 0, end: 1, layout: 'orbit', label: 'Orbit', camera: 'approach' }, phaseProgress: 0.5, seed: 42, emphasis: 'quiet',
    });
    expect(result).toEqual(choreographPhotoTransform(transform, {
      memoryId: 'memory-1', memoryIndex: 1, phase: { id: 'orbit', start: 0, end: 1, layout: 'orbit', label: 'Orbit', camera: 'approach' }, phaseProgress: 0.5, seed: 42, emphasis: 'quiet',
    }));
    expect(result.position).not.toEqual(transform.position);
  });

  it('does not jump when a phase starts', () => {
    const input = {
      memoryId: 'memory-1', memoryIndex: 1, phase: { id: 'orbit', start: 0, end: 1, layout: 'orbit' as const, label: 'Orbit', camera: 'approach' as const, motion: 'carousel' as const }, seed: 42, emphasis: 'quiet' as const,
    };
    const nearStart = choreographPhotoTransform(transform, { ...input, phaseProgress: 0.0001 });
    expect(Math.hypot(
      nearStart.position[0] - transform.position[0],
      nearStart.position[1] - transform.position[1],
      nearStart.position[2] - transform.position[2],
    )).toBeLessThan(0.002);
  });

  it('creates a clear depth hierarchy during a hero camera phase', () => {
    const phase = { id: 'hero', start: 0, end: 1, layout: 'orbit' as const, label: 'Hero', camera: 'hero' as const };
    const hero = choreographPhotoTransform(transform, {
      memoryId: 'hero', memoryIndex: 0, phase, phaseProgress: 0.5, seed: 42, emphasis: 'hero',
    });
    const supporting = choreographPhotoTransform(transform, {
      memoryId: 'supporting', memoryIndex: 1, phase, phaseProgress: 0.5, seed: 42, emphasis: 'quiet',
    });

    expect(hero.position[2]).toBeGreaterThan(supporting.position[2]);
    expect(hero.scale).toBeGreaterThan(supporting.scale);
    expect(hero.opacity).toBeGreaterThan(supporting.opacity);
  });

  it('drops incoming photos from above and settles them with a damped bounce', () => {
    const phase = { id: 'drop', start: 0, end: 1, layout: 'gravity' as const, label: 'Drop', camera: 'wide' as const, motion: 'gravity-drop' as const };
    const falling = choreographPhotoTransform(transform, {
      memoryId: 'falling', memoryIndex: 4, phase, phaseProgress: 0.08, seed: 42, emphasis: 'quiet', incoming: true,
    });
    const bouncing = choreographPhotoTransform(transform, {
      memoryId: 'falling', memoryIndex: 4, phase, phaseProgress: 0.68, seed: 42, emphasis: 'quiet', incoming: true,
    });
    const settled = choreographPhotoTransform(transform, {
      memoryId: 'falling', memoryIndex: 4, phase, phaseProgress: 1, seed: 42, emphasis: 'quiet', incoming: true,
    });

    expect(falling.position[1]).toBeGreaterThan(transform.position[1] + 8);
    expect(bouncing.position[1]).toBeGreaterThanOrEqual(transform.position[1]);
    expect(settled).toBe(transform);
  });

  it.each(['film-rail', 'accordion-fold', 'magnetic-swap', 'spiral-lift', 'wave-surface'] as const)(
    'gives the %s chapter a deterministic group journey',
    (motion) => {
      const phase = { id: motion, start: 0, end: 1, layout: 'mosaic' as const, label: motion, camera: 'wide' as const, motion };
      const input = {
        memoryId: 'memory-12', memoryIndex: 12, phase, phaseProgress: 0.5, seed: 42, emphasis: 'quiet' as const,
      };
      const first = choreographPhotoTransform(transform, input);
      const second = choreographPhotoTransform(transform, input);

      expect(first).toEqual(second);
      expect(first.position).not.toEqual(transform.position);
      expect(choreographPhotoTransform(transform, { ...input, phaseProgress: 1 })).toBe(transform);
    },
  );
});
