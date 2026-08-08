import { describe, expect, it } from 'vitest';

import type { Relationship, RelationshipReason } from '../../domain/relationship';
import { createMemoryFixture } from '../../test/fixtures/memoryFixture';
import { buildRelationshipGraph, rankEchoCandidates } from './buildRelationshipGraph';

function relationship(
  sourceId: string,
  targetId: string,
  score: number,
  reason: RelationshipReason,
): Relationship {
  return {
    sourceId,
    targetId,
    score,
    reasons: [{ type: reason, contribution: score, label: reason }],
    engineVersion: 1,
  };
}

describe('buildRelationshipGraph', () => {
  it('isolates demo and personal sources and never emits duplicate edges', () => {
    const memories = [
      ...Array.from({ length: 7 }, (_, index) =>
        createMemoryFixture({
          id: `demo-${String(index)}`,
          source: 'demo',
          capturedAt: null,
          capturedAtMs: null,
          dominantColor: { rgb: [40, 50, 60] },
        }),
      ),
      createMemoryFixture({ id: 'personal-1', source: 'personal', capturedAt: null, capturedAtMs: null }),
      createMemoryFixture({ id: 'personal-2', source: 'personal', capturedAt: null, capturedAtMs: null }),
    ];

    const graph = buildRelationshipGraph(memories, [], 2, 2);
    const idsBySource = new Map(memories.map((memory) => [memory.id, memory.source]));
    const keys = graph.map((edge) => `${edge.sourceId}::${edge.targetId}`);

    expect(new Set(keys).size).toBe(keys.length);
    expect(graph.every((edge) => idsBySource.get(edge.sourceId) === idsBySource.get(edge.targetId))).toBe(true);
    expect(graph.some((edge) => edge.sourceId.startsWith('demo-'))).toBe(true);
  });

  it('keeps each node connected to its top-k candidates when the strong threshold is disabled', () => {
    const memories = Array.from({ length: 5 }, (_, index) =>
      createMemoryFixture({
        id: `m-${String(index)}`,
        capturedAt: null,
        capturedAtMs: null,
        dominantColor: { rgb: [80, 90, 100] },
      }),
    );
    const graph = buildRelationshipGraph(memories, [], 2, 2);

    for (const memory of memories) {
      const incident = graph.filter(
        (edge) => edge.sourceId === memory.id || edge.targetId === memory.id,
      );
      expect(incident.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('rankEchoCandidates', () => {
  it('favours diverse primary reasons before filling with repeated reasons', () => {
    const graph = [
      relationship('origin', 'person-best', 0.9, 'shared-person'),
      relationship('origin', 'person-next', 0.85, 'shared-person'),
      relationship('origin', 'place', 0.8, 'same-place'),
      relationship('origin', 'mood', 0.7, 'same-mood'),
    ];

    const ranked = rankEchoCandidates('origin', graph, [], 3);
    expect(ranked.map((candidate) => candidate.memoryId)).toEqual(['person-best', 'place', 'mood']);
  });

  it('downweights the two most recent memory ids', () => {
    const graph = [
      relationship('origin', 'recent', 0.95, 'shared-person'),
      relationship('origin', 'fresh', 0.7, 'shared-person'),
    ];

    const ranked = rankEchoCandidates('origin', graph, ['older', 'recent'], 2);
    expect(ranked[0]?.memoryId).toBe('fresh');
    expect(ranked.find((candidate) => candidate.memoryId === 'recent')?.adjustedScore).toBeCloseTo(
      0.95 * 0.55,
    );
  });
});
