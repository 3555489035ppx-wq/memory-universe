import { finiteVec3, seededUnit, type LayoutInput, type LayoutPositions } from './layoutTypes';

export function createPlaceLayout(input: LayoutInput): LayoutPositions {
  const placeIds = (input.places ?? [])
    .map((place) => place.id)
    .toSorted((left, right) => left.localeCompare(right));
  const effectiveIds = placeIds.length > 0 ? placeIds : ['unmarked-place'];
  const anchors = new Map(
    effectiveIds.map((id, index) => {
      const column = index % 3;
      const row = Math.floor(index / 3);
      return [id, [(column - 1) * 4.8, (row - 1) * 3.4, (column + row) % 2 ? -1.6 : 1.1]] as const;
    }),
  );
  const positions: LayoutPositions = {};
  for (const memory of input.memories.toSorted((left, right) => left.id.localeCompare(right.id))) {
    const anchor = (memory.placeId ? anchors.get(memory.placeId) : undefined) ?? [0, -4.5, -2];
    const angle = seededUnit(memory.id, input.viewportSeed) * Math.PI * 2;
    positions[memory.id] = finiteVec3([
      anchor[0] + Math.cos(angle) * 1.2,
      anchor[1] + Math.sin(angle) * 1.2,
      anchor[2] + (seededUnit(memory.id, input.viewportSeed + 2) - 0.5) * 2.2,
    ]);
  }
  return positions;
}
