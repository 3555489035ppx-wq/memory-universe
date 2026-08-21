import { describe, expect, it } from 'vitest';

import { analyzePcm } from './loudnessMeter';

function sine(frequency: number, amplitude: number, seconds = 1, sampleRate = 48_000): Float32Array {
  return Float32Array.from({ length: sampleRate * seconds }, (_, frame) =>
    Math.sin((frame / sampleRate) * frequency * Math.PI * 2) * amplitude,
  );
}

describe('offline loudness meter', () => {
  it('measures a stereo 1kHz sine with deterministic gated loudness and peaks', () => {
    const channel = sine(1_000, 0.1);
    const metrics = analyzePcm({ channels: [channel, channel], sampleRate: 48_000 });
    expect(metrics.integratedLufs).toBeCloseTo(-20.69, 1);
    expect(metrics.samplePeakDbfs).toBeCloseTo(-20, 1);
    expect(metrics.maximumTruePeakDbtp).toBeCloseTo(-20, 1);
    expect(metrics.clippingSamples).toBe(0);
    expect(metrics.invalidSamples).toBe(0);
  });

  it('counts invalid and consecutively clipped samples instead of hiding them', () => {
    const channel = new Float32Array([0, 1, 1.1, -1.2, 0, Number.NaN]);
    const metrics = analyzePcm({ channels: [channel], sampleRate: 48_000 });
    expect(metrics.clippingSamples).toBe(3);
    expect(metrics.longestClippingRun).toBe(3);
    expect(metrics.invalidSamples).toBe(1);
  });
});
