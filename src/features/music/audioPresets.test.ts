import { describe, expect, it } from 'vitest';

import { AUDIO_PRESETS, dbToGain, gainToDb } from './audioPresets';

describe('audio mastering presets', () => {
  it('keeps studio-master-v1 within the documented safe operating range', () => {
    const preset = AUDIO_PRESETS['studio-master-v1'];
    expect(preset.processingSampleRate).toBe(48_000);
    expect(preset.targetIntegratedLufs).toBe(-14);
    expect(preset.limiter).toEqual({ ceilingDbtp: -1, oversampling: 4 });
    expect(preset.maxAutoGainDb).toBe(6);
    expect(preset.eqBands.every((band) => Math.abs(band.gain) <= 1.5)).toBe(true);
    expect(preset.compressor.ratio).toBeGreaterThanOrEqual(1.5);
    expect(preset.compressor.ratio).toBeLessThanOrEqual(2.5);
  });

  it('uses invertible dB gain conversion for automation and offline rendering', () => {
    expect(gainToDb(dbToGain(-3))).toBeCloseTo(-3, 8);
    expect(gainToDb(dbToGain(2.5))).toBeCloseTo(2.5, 8);
  });
});
