import { describe, expect, it } from 'vitest';

import { createMemoryFixture } from '../../test/fixtures/memoryFixture';
import { analyzeLayoutDiagnostics, needsClusteredTimeFallback } from './layoutDiagnostics';

describe('layout diagnostics', () => {
  it('detects a same-day personal import as clustered time data', () => {
    const memories = Array.from({ length: 80 }, (_, index) => createMemoryFixture({
      id: `same-day-${String(index).padStart(2, '0')}`,
      source: 'personal',
      capturedAt: '2026-08-10T12:00:00.000Z',
      capturedAtMs: Date.parse('2026-08-10T12:00:00.000Z') + index * 1000,
    }));

    const diagnostics = analyzeLayoutDiagnostics(memories);
    expect(diagnostics.temporalQuality).toBe('clustered');
    expect(diagnostics.uniqueDayCount).toBe(1);
    expect(diagnostics.dominantDayRatio).toBe(1);
    expect(needsClusteredTimeFallback(diagnostics)).toBe(true);
  });

  it('keeps a varied chronological dataset on the semantic time path', () => {
    const memories = Array.from({ length: 12 }, (_, index) => createMemoryFixture({
      id: `month-${String(index).padStart(2, '0')}`,
      capturedAt: new Date(Date.UTC(2025, index, 1)).toISOString(),
      capturedAtMs: Date.UTC(2025, index, 1),
    }));

    const diagnostics = analyzeLayoutDiagnostics(memories);
    expect(diagnostics.temporalQuality).toBe('rich');
    expect(needsClusteredTimeFallback(diagnostics)).toBe(false);
  });
});
