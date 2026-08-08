import type { Relationship } from '../../domain/relationship';

export function explainRelationship(relationship: Relationship, limit = 2): string {
  if (relationship.reasons.length === 0) return '关系较弱';
  return relationship.reasons
    .toSorted((left, right) => right.contribution - left.contribution)
    .slice(0, Math.max(1, limit))
    .map((reason) => reason.label)
    .join(' · ');
}
