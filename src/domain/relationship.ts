export type RelationshipReason =
  | 'shared-person'
  | 'same-place'
  | 'within-24h'
  | 'within-7d'
  | 'same-mood'
  | 'shared-tags'
  | 'similar-color';

export interface RelationshipContribution {
  type: RelationshipReason;
  contribution: number;
  label: string;
}

export interface Relationship {
  sourceId: string;
  targetId: string;
  score: number;
  reasons: RelationshipContribution[];
  engineVersion: number;
}

export const RELATIONSHIP_ENGINE_VERSION = 1;
