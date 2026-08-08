import { describe, expect, it } from 'vitest';

import type { Person } from '../../domain/person';
import type { Place } from '../../domain/place';
import { createMemoryFixture } from '../../test/fixtures/memoryFixture';
import { createEmotionLayout } from './emotionLayout';
import { createPeopleLayout } from './peopleLayout';
import { createPlaceLayout } from './placeLayout';
import { createTimeLayout } from './timeLayout';
import type { LayoutPositions } from './layoutTypes';

const now = '2026-08-04T00:00:00.000Z';
const people: Person[] = [
  { id: 'person-a', source: 'demo', name: '阿岚', createdAt: now, updatedAt: now },
  { id: 'person-b', source: 'demo', name: '小川', createdAt: now, updatedAt: now },
];
const places: Place[] = [
  { id: 'place-a', source: 'demo', name: '海边', createdAt: now, updatedAt: now },
  { id: 'place-b', source: 'demo', name: '旧屋', createdAt: now, updatedAt: now },
];
const memories = [
  createMemoryFixture({ id: 'a', capturedAt: '2021-01-01T09:00:00', personIds: ['person-a'], placeId: 'place-a', mood: 'happy' }),
  createMemoryFixture({ id: 'b', capturedAt: '2023-06-15T12:00:00', personIds: ['person-a', 'person-b'], placeId: 'place-b', mood: 'nostalgic' }),
  createMemoryFixture({ id: 'c', capturedAt: null, capturedAtMs: null, personIds: [], placeId: null, mood: null }),
];

function expectFiniteLayout(layout: LayoutPositions): void {
  expect(Object.keys(layout).sort()).toEqual(['a', 'b', 'c']);
  for (const position of Object.values(layout)) {
    expect(position).toHaveLength(3);
    expect(position.every(Number.isFinite)).toBe(true);
  }
}

describe('universe layouts', () => {
  it('are deterministic even when the input order changes', () => {
    const input = { memories, relationships: [], people, places, viewportSeed: 42 };
    const reversed = { ...input, memories: memories.toReversed() };
    const factories = [createTimeLayout, createPeopleLayout, createPlaceLayout, createEmotionLayout];

    for (const factory of factories) {
      expect(factory(input)).toEqual(factory(reversed));
      expectFiniteLayout(factory(input));
    }
  });

  it('places missing dates in a separate time cluster and produces distinct semantic views', () => {
    const input = { memories, relationships: [], people, places, viewportSeed: 42 };
    const time = createTimeLayout(input);
    const peopleView = createPeopleLayout(input);
    const placeView = createPlaceLayout(input);
    const emotion = createEmotionLayout(input);

    expect(time.c?.[0]).toBeLessThan(-4);
    expect(time).not.toEqual(peopleView);
    expect(peopleView).not.toEqual(placeView);
    expect(placeView).not.toEqual(emotion);
  });

  it('changes only the deterministic jitter when the viewport seed changes', () => {
    const base = { memories, relationships: [], people, places };
    expect(createPeopleLayout({ ...base, viewportSeed: 1 })).not.toEqual(
      createPeopleLayout({ ...base, viewportSeed: 2 }),
    );
  });
});
