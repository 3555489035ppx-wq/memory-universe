import { describe, expect, it } from 'vitest';

import type { Place } from '../../domain/place';
import { createMemoryFixture } from '../../test/fixtures/memoryFixture';
import {
  colorSimilarity,
  distanceInKilometers,
  scoreRelationship,
  tagJaccard,
} from './scoreRelationship';

describe('scoreRelationship', () => {
  it('applies every documented contribution and clamps the total to one', () => {
    const first = createMemoryFixture({
      id: 'a',
      personIds: ['person-1'],
      placeId: 'place-1',
      mood: 'calm',
      tags: ['海边'],
      dominantColor: { rgb: [90, 110, 120] },
    });
    const second = createMemoryFixture({
      id: 'b',
      capturedAt: '2024-04-10T12:00:00',
      personIds: ['person-1'],
      placeId: 'place-1',
      mood: 'calm',
      tags: ['海边'],
      dominantColor: { rgb: [90, 110, 120] },
    });

    const relationship = scoreRelationship(first, second);

    expect(relationship.score).toBe(1);
    expect(relationship.reasons.map((reason) => reason.type)).toEqual([
      'shared-person',
      'same-place',
      'within-24h',
      'same-mood',
      'shared-tags',
      'similar-color',
    ]);
    expect(relationship.reasons.map((reason) => reason.contribution)).toEqual([
      0.35, 0.25, 0.2, 0.1, 0.1, 0.1,
    ]);
  });

  it('keeps the 24-hour and seven-day time bands mutually exclusive', () => {
    const origin = createMemoryFixture({ id: 'a', dominantColor: { rgb: [0, 0, 0] } });
    const withinDay = createMemoryFixture({
      id: 'b',
      capturedAt: '2024-04-10T20:00:00',
      dominantColor: { rgb: [255, 255, 255] },
    });
    const withinWeek = createMemoryFixture({
      id: 'c',
      capturedAt: '2024-04-12T08:00:00',
      dominantColor: { rgb: [255, 255, 255] },
    });

    expect(scoreRelationship(origin, withinDay).reasons.map((reason) => reason.type)).toEqual([
      'within-24h',
    ]);
    expect(scoreRelationship(origin, withinWeek).reasons.map((reason) => reason.type)).toEqual([
      'within-7d',
    ]);
  });

  it('normalizes tags and scores their Jaccard overlap', () => {
    expect(tagJaccard([' A ', 'b', 'a'], ['a', 'c'])).toBeCloseTo(1 / 3, 8);
    expect(tagJaccard([], [])).toBe(0);
  });

  it('treats places within one kilometer as the same place', () => {
    const now = '2026-08-04T00:00:00.000Z';
    const places: Place[] = [
      { id: 'p1', source: 'demo', name: '起点', latitude: 31.2304, longitude: 121.4737, createdAt: now, updatedAt: now },
      { id: 'p2', source: 'demo', name: '附近', latitude: 31.235, longitude: 121.4737, createdAt: now, updatedAt: now },
    ];
    const first = createMemoryFixture({ id: 'a', placeId: 'p1', dominantColor: { rgb: [0, 0, 0] } });
    const second = createMemoryFixture({
      id: 'b',
      capturedAt: '2024-05-20T08:00:00',
      placeId: 'p2',
      dominantColor: { rgb: [255, 255, 255] },
    });

    expect(distanceInKilometers([31.2304, 121.4737], [31.235, 121.4737])).toBeLessThan(1);
    expect(
      scoreRelationship(first, second, { placesById: new Map(places.map((place) => [place.id, place])) })
        .reasons.map((reason) => reason.type),
    ).toEqual(['same-place']);
  });

  it('is stable regardless of input order and has bounded color similarity', () => {
    const first = createMemoryFixture({ id: 'a', tags: ['夜晚'], dominantColor: { rgb: [12, 20, 35] } });
    const second = createMemoryFixture({ id: 'b', tags: ['夜晚'], dominantColor: { rgb: [16, 24, 40] } });

    expect(scoreRelationship(first, second)).toEqual(scoreRelationship(second, first));
    expect(colorSimilarity([0, 0, 0], [0, 0, 0])).toBe(1);
    expect(colorSimilarity([0, 0, 0], [255, 255, 255])).toBeGreaterThanOrEqual(0);
    expect(colorSimilarity([0, 0, 0], [255, 255, 255])).toBeLessThanOrEqual(1);
  });
});
