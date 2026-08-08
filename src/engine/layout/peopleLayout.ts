import { finiteVec3, seededUnit, type LayoutInput, type LayoutPositions } from './layoutTypes';

export function createPeopleLayout(input: LayoutInput): LayoutPositions {
  const peopleIds = (input.people ?? [])
    .map((person) => person.id)
    .toSorted((left, right) => left.localeCompare(right));
  const anchorIds = peopleIds.length > 0 ? peopleIds : ['unmarked-person'];
  const anchors = new Map(
    anchorIds.map((id, index) => {
      const angle = (index / anchorIds.length) * Math.PI * 2;
      return [id, [Math.cos(angle) * 5, Math.sin(angle) * 3, Math.sin(angle * 2) * 1.5]] as const;
    }),
  );
  const positions: LayoutPositions = {};

  for (const memory of input.memories.toSorted((left, right) => left.id.localeCompare(right.id))) {
    const ids = memory.personIds.filter((id) => anchors.has(id));
    const effectiveIds = ids.length > 0 ? ids : ['unmarked-person'];
    const points = effectiveIds.map((id) => anchors.get(id) ?? [0, -4, -2]);
    const centroid = points.reduce(
      (sum, point) => [sum[0] + point[0], sum[1] + point[1], sum[2] + point[2]],
      [0, 0, 0],
    );
    const jitter = seededUnit(memory.id, input.viewportSeed) * Math.PI * 2;
    positions[memory.id] = finiteVec3([
      centroid[0] / points.length + Math.cos(jitter) * 1.15,
      centroid[1] / points.length + Math.sin(jitter) * 0.85,
      centroid[2] / points.length + (seededUnit(memory.id, input.viewportSeed + 1) - 0.5) * 2,
    ]);
  }
  return positions;
}
