import type { Memory } from '../../domain/memory';

export type TemporalLayoutQuality = 'rich' | 'clustered' | 'missing';

export interface LayoutDiagnostics {
  total: number;
  dated: number;
  undated: number;
  datedRatio: number;
  uniqueDayCount: number;
  uniqueDayRatio: number;
  dominantDayRatio: number;
  aspectEntropy: number;
  temporalQuality: TemporalLayoutQuality;
}

const DAY_MS = 86_400_000;

function normalizedAspectEntropy(memories: readonly Memory[]): number {
  if (memories.length <= 1) return 0;
  const buckets = new Map<string, number>();
  for (const memory of memories) {
    const aspect = memory.width / Math.max(1, memory.height);
    const bucket = aspect < 0.68
      ? 'portrait-extreme'
      : aspect < 0.9
        ? 'portrait'
        : aspect <= 1.12
          ? 'square'
          : aspect <= 1.7
            ? 'landscape'
            : 'landscape-extreme';
    buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
  }
  if (buckets.size <= 1) return 0;
  const entropy = [...buckets.values()].reduce((sum, count) => {
    const probability = count / memories.length;
    return sum - probability * Math.log(probability);
  }, 0);
  return entropy / Math.log(5);
}

export function analyzeLayoutDiagnostics(memories: readonly Memory[]): LayoutDiagnostics {
  const total = memories.length;
  const datedMemories = memories.filter((memory) => memory.capturedAtMs !== null);
  const dayCounts = new Map<number, number>();
  for (const memory of datedMemories) {
    const day = Math.floor((memory.capturedAtMs ?? 0) / DAY_MS);
    dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1);
  }
  const dated = datedMemories.length;
  const datedRatio = total === 0 ? 0 : dated / total;
  const uniqueDayCount = dayCounts.size;
  const uniqueDayRatio = dated === 0 ? 0 : uniqueDayCount / dated;
  const dominantDayCount = Math.max(0, ...dayCounts.values());
  const dominantDayRatio = dated === 0 ? 0 : dominantDayCount / dated;
  const temporalQuality: TemporalLayoutQuality = datedRatio < 0.45
    ? 'missing'
    : uniqueDayRatio < 0.25 || dominantDayRatio > 0.65
      ? 'clustered'
      : 'rich';

  return {
    total,
    dated,
    undated: total - dated,
    datedRatio,
    uniqueDayCount,
    uniqueDayRatio,
    dominantDayRatio,
    aspectEntropy: normalizedAspectEntropy(memories),
    temporalQuality,
  };
}

export function needsClusteredTimeFallback(diagnostics: LayoutDiagnostics): boolean {
  return diagnostics.total > 1 && diagnostics.temporalQuality !== 'rich';
}
