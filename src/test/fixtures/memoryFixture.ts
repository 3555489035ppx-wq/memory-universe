import type { Memory, MemorySource, Mood } from '../../domain/memory';

export interface MemoryFixtureOverrides extends Partial<Omit<Memory, 'dominantColor' | 'assetKeys'>> {
  dominantColor?: Partial<Memory['dominantColor']>;
  assetKeys?: Partial<Memory['assetKeys']>;
}

export function createMemoryFixture(overrides: MemoryFixtureOverrides = {}): Memory {
  const id = overrides.id ?? 'memory-a';
  const source: MemorySource = overrides.source ?? 'demo';
  const capturedAt = overrides.capturedAt === undefined ? '2024-04-10T08:00:00' : overrides.capturedAt;
  const capturedAtMs =
    overrides.capturedAtMs === undefined
      ? capturedAt
        ? new Date(capturedAt).getTime()
        : null
      : overrides.capturedAtMs;
  const mood: Mood = overrides.mood === undefined ? null : overrides.mood;
  const now = '2026-08-04T00:00:00.000Z';

  return {
    id,
    source,
    title: overrides.title ?? id,
    description: overrides.description ?? '',
    capturedAt,
    capturedAtMs,
    dateSource: overrides.dateSource ?? (capturedAt ? 'manual' : 'unknown'),
    personIds: overrides.personIds ?? [],
    placeId: overrides.placeId === undefined ? null : overrides.placeId,
    mood,
    tags: overrides.tags ?? [],
    dominantColor: {
      rgb: overrides.dominantColor?.rgb ?? [0, 0, 0],
      hsl: overrides.dominantColor?.hsl ?? [0, 0, 0],
      luminance: overrides.dominantColor?.luminance ?? 0,
      algorithmVersion: overrides.dominantColor?.algorithmVersion ?? 1,
    },
    assetKeys: {
      micro: overrides.assetKeys?.micro ?? `${source}:${id}:micro`,
      thumbnail: overrides.assetKeys?.thumbnail ?? `${source}:${id}:thumbnail`,
      preview: overrides.assetKeys?.preview ?? `${source}:${id}:preview`,
      ...(overrides.assetKeys?.original ? { original: overrides.assetKeys.original } : {}),
    },
    width: overrides.width ?? 1600,
    height: overrides.height ?? 1067,
    orientationApplied: overrides.orientationApplied ?? true,
    ...(overrides.cameraModel ? { cameraModel: overrides.cameraModel } : {}),
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    schemaVersion: overrides.schemaVersion ?? 1,
  };
}
