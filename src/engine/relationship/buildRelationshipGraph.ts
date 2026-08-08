import type { Memory } from '../../domain/memory';
import type { Place } from '../../domain/place';
import type { Relationship, RelationshipReason } from '../../domain/relationship';
import { scoreRelationship } from './scoreRelationship';

export const RELATIONSHIP_TOP_K = 6;
export const STRONG_RELATIONSHIP_THRESHOLD = 0.62;

function relationshipKey(relationship: Relationship): string {
  return `${relationship.sourceId}::${relationship.targetId}`;
}

export function buildRelationshipGraph(
  memories: readonly Memory[],
  places: readonly Place[] = [],
  topK = RELATIONSHIP_TOP_K,
  strongThreshold = STRONG_RELATIONSHIP_THRESHOLD,
): Relationship[] {
  const placesById = new Map(places.map((place) => [place.id, place]));
  const sorted = memories.toSorted((left, right) => left.id.localeCompare(right.id));
  const candidates: Relationship[] = [];

  for (let leftIndex = 0; leftIndex < sorted.length; leftIndex += 1) {
    const left = sorted[leftIndex];
    if (!left) continue;
    for (let rightIndex = leftIndex + 1; rightIndex < sorted.length; rightIndex += 1) {
      const right = sorted[rightIndex];
      if (!right || left.source !== right.source) continue;
      const relationship = scoreRelationship(left, right, { placesById });
      if (relationship.score > 0) candidates.push(relationship);
    }
  }

  const selected = new Map<string, Relationship>();
  for (const memory of sorted) {
    const incident = candidates
      .filter(
        (relationship) =>
          relationship.sourceId === memory.id || relationship.targetId === memory.id,
      )
      .toSorted(
        (left, right) =>
          right.score - left.score || relationshipKey(left).localeCompare(relationshipKey(right)),
      );
    for (const relationship of incident) {
      if (relationship.score >= strongThreshold || incident.indexOf(relationship) < topK) {
        selected.set(relationshipKey(relationship), relationship);
      }
    }
  }

  return [...selected.values()].toSorted((left, right) =>
    relationshipKey(left).localeCompare(relationshipKey(right)),
  );
}

export interface EchoCandidate {
  memoryId: string;
  relationship: Relationship;
  adjustedScore: number;
}

function primaryReason(relationship: Relationship): RelationshipReason | 'none' {
  return relationship.reasons.toSorted((left, right) => right.contribution - left.contribution)[0]
    ?.type ?? 'none';
}

export function rankEchoCandidates(
  sourceId: string,
  relationships: readonly Relationship[],
  recentPath: readonly string[] = [],
  limit = 6,
): EchoCandidate[] {
  const recentIds = new Set(recentPath.slice(-2));
  const candidates = relationships
    .filter((relationship) => relationship.sourceId === sourceId || relationship.targetId === sourceId)
    .map((relationship) => {
      const memoryId =
        relationship.sourceId === sourceId ? relationship.targetId : relationship.sourceId;
      return {
        memoryId,
        relationship,
        adjustedScore: relationship.score * (recentIds.has(memoryId) ? 0.55 : 1),
      };
    })
    .toSorted(
      (left, right) =>
        right.adjustedScore - left.adjustedScore || left.memoryId.localeCompare(right.memoryId),
    );

  const result: EchoCandidate[] = [];
  const usedReasons = new Set<RelationshipReason | 'none'>();
  for (const candidate of candidates) {
    const reason = primaryReason(candidate.relationship);
    if (!usedReasons.has(reason)) {
      result.push(candidate);
      usedReasons.add(reason);
    }
    if (result.length >= limit) return result;
  }
  for (const candidate of candidates) {
    if (!result.includes(candidate)) result.push(candidate);
    if (result.length >= limit) break;
  }
  return result;
}
