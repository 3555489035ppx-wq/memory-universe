import type { Memory } from '../../domain/memory';
import type { Relationship } from '../../domain/relationship';
import type { UniverseDataset } from '../../stores/sceneStore';

const MOOD_NAMES: Record<string, string> = {
  happy: '快乐',
  calm: '平静',
  nostalgic: '怀念',
  excited: '兴奋',
  chaotic: '混乱',
  lonely: '孤独',
};

export function formatMemoryDate(memory: Memory, includeTime = false): string {
  if (memory.capturedAtMs === null) return '时间未标记';
  const date = new Date(memory.capturedAtMs);
  const formatter = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit', hour12: false } : {}),
  });
  return formatter.format(date).replaceAll('/', '.');
}

export function placeName(memory: Memory, dataset: UniverseDataset): string {
  return dataset.places.find((place) => place.id === memory.placeId)?.name ?? '地点未标记';
}

export function explainRelationshipWithNames(
  relationship: Relationship,
  dataset: UniverseDataset,
  limit = 2,
): string {
  const replacements = new Map<string, string>();
  for (const person of dataset.people) replacements.set(person.id, person.name);
  for (const place of dataset.places) replacements.set(place.id, place.name);

  return relationship.reasons
    .toSorted((left, right) => right.contribution - left.contribution)
    .slice(0, Math.max(1, limit))
    .map((reason) => {
      let label = reason.label;
      for (const [id, name] of replacements) label = label.replaceAll(id, name);
      for (const [mood, name] of Object.entries(MOOD_NAMES)) label = label.replaceAll(mood, name);
      return label;
    })
    .join(' · ');
}
