import { gainToDb } from './audioPresets';

export interface AudioMeterSnapshot {
  samplePeakDbfs: number;
  truePeakDbtp: number | null;
  compressorReductionDb: number;
  limiterReductionDb: number;
  clipping: boolean;
  limiterReady: boolean;
}

export function peakFromSamples(samples: Float32Array): { peak: number; clipping: boolean } {
  let peak = 0;
  let clipping = false;
  for (const sample of samples) {
    const absolute = Math.abs(sample);
    if (absolute > peak) peak = absolute;
    if (absolute >= 1) clipping = true;
  }
  return { peak, clipping };
}

export function createAudioMeterSnapshot(
  samples: Float32Array,
  compressorReduction: number,
  limiter: { truePeak: number; reductionDb: number; ready: boolean } | null,
): AudioMeterSnapshot {
  const sample = peakFromSamples(samples);
  return {
    samplePeakDbfs: gainToDb(sample.peak),
    truePeakDbtp: limiter?.ready ? gainToDb(limiter.truePeak) : null,
    compressorReductionDb: Math.max(0, -compressorReduction),
    limiterReductionDb: Math.max(0, limiter?.reductionDb ?? 0),
    clipping: sample.clipping || Boolean(limiter && limiter.truePeak > 1),
    limiterReady: limiter?.ready ?? false,
  };
}
