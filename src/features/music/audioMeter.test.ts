import { describe, expect, it } from 'vitest';

import { createAudioMeterSnapshot, peakFromSamples } from './audioMeter';

describe('audio meter', () => {
  it('reports absolute sample peak and clipping without treating FFT energy as loudness', () => {
    const result = peakFromSamples(new Float32Array([-0.2, 0.5, -1.01, 0.1]));
    expect(result.peak).toBeCloseTo(1.01, 5);
    expect(result.clipping).toBe(true);
  });

  it('normalizes compressor and limiter reduction to positive display values', () => {
    const result = createAudioMeterSnapshot(
      new Float32Array([0.25, -0.5]),
      -2.4,
      { truePeak: 0.88, reductionDb: 1.2, ready: true },
    );
    expect(result.compressorReductionDb).toBe(2.4);
    expect(result.limiterReductionDb).toBe(1.2);
    expect(result.truePeakDbtp).toBeLessThan(0);
  });
});
