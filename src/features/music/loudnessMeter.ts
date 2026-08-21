import { gainToDb } from './audioPresets';

export interface PcmAudioData {
  channels: readonly Float32Array[];
  sampleRate: number;
}

export interface LoudnessMetrics {
  integratedLufs: number;
  samplePeakDbfs: number;
  maximumTruePeakDbtp: number;
  rmsDbfs: number;
  dynamicRangeLu: number;
  clippingSamples: number;
  longestClippingRun: number;
  invalidSamples: number;
  durationSeconds: number;
  sampleRate: number;
  channels: number;
}

interface EnergyBlock {
  energy: number;
  lufs: number;
}

function finiteSample(value: number | undefined): number {
  return Number.isFinite(value) ? value ?? 0 : 0;
}

function percentile(sorted: readonly number[], ratio: number): number {
  if (sorted.length === 0) return -120;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * ratio)));
  return sorted[index] ?? -120;
}

function lufsFromEnergy(energy: number): number {
  return energy > 1e-12 ? -0.691 + 10 * Math.log10(energy) : -120;
}

function blockEnergies(audio: PcmAudioData): EnergyBlock[] {
  if (audio.channels.length === 0 || audio.sampleRate <= 0) return [];
  const frameCount = Math.min(...audio.channels.map((channel) => channel.length));
  if (frameCount <= 0) return [];
  const blockFrames = Math.max(1, Math.round(audio.sampleRate * 0.4));
  const hopFrames = Math.max(1, Math.round(audio.sampleRate * 0.1));
  const blocks: EnergyBlock[] = [];
  for (let start = 0; start < frameCount; start += hopFrames) {
    const end = Math.min(frameCount, start + blockFrames);
    if (end - start < Math.min(blockFrames, Math.round(audio.sampleRate * 0.1))) break;
    let sum = 0;
    for (const channel of audio.channels) {
      for (let frame = start; frame < end; frame += 1) {
        const sample = finiteSample(channel[frame]);
        sum += sample * sample;
      }
    }
    const energy = sum / Math.max(1, end - start);
    blocks.push({ energy, lufs: lufsFromEnergy(energy) });
  }
  return blocks;
}

/**
 * Deterministic BS.1770-style gated loudness analysis for decoded PCM. It
 * uses the standard absolute/relative gating model and a 4× linear
 * inter-sample peak estimate. Browser output is labelled as an estimate rather
 * than a laboratory-certified meter.
 */
export function analyzePcm(audio: PcmAudioData): LoudnessMetrics {
  const channelCount = audio.channels.length;
  const frameCount = channelCount > 0 ? Math.min(...audio.channels.map((channel) => channel.length)) : 0;
  let samplePeak = 0;
  let truePeak = 0;
  let totalSquares = 0;
  let clippingSamples = 0;
  let longestClippingRun = 0;
  let invalidSamples = 0;

  for (const channel of audio.channels) {
    let previous = 0;
    let clippingRun = 0;
    for (let frame = 0; frame < frameCount; frame += 1) {
      const raw = channel[frame];
      if (!Number.isFinite(raw)) invalidSamples += 1;
      const sample = finiteSample(raw);
      const absolute = Math.abs(sample);
      samplePeak = Math.max(samplePeak, absolute);
      totalSquares += sample * sample;
      if (absolute >= 1) {
        clippingSamples += 1;
        clippingRun += 1;
        longestClippingRun = Math.max(longestClippingRun, clippingRun);
      } else {
        clippingRun = 0;
      }
      for (let step = 1; step <= 4; step += 1) {
        truePeak = Math.max(truePeak, Math.abs(previous + (sample - previous) * (step / 4)));
      }
      previous = sample;
    }
  }

  const blocks = blockEnergies(audio);
  const absoluteGated = blocks.filter((block) => block.lufs >= -70);
  const ungatedEnergy = absoluteGated.length > 0
    ? absoluteGated.reduce((sum, block) => sum + block.energy, 0) / absoluteGated.length
    : 0;
  const relativeGate = lufsFromEnergy(ungatedEnergy) - 10;
  const gated = absoluteGated.filter((block) => block.lufs >= relativeGate);
  const integratedEnergy = gated.length > 0
    ? gated.reduce((sum, block) => sum + block.energy, 0) / gated.length
    : 0;
  const loudnessDistribution = gated.map((block) => block.lufs).toSorted((left, right) => left - right);
  const meanSquare = totalSquares / Math.max(1, frameCount * Math.max(1, channelCount));

  return {
    integratedLufs: lufsFromEnergy(integratedEnergy),
    samplePeakDbfs: gainToDb(samplePeak),
    maximumTruePeakDbtp: gainToDb(truePeak),
    rmsDbfs: gainToDb(Math.sqrt(meanSquare)),
    dynamicRangeLu: Math.max(0, percentile(loudnessDistribution, 0.9) - percentile(loudnessDistribution, 0.1)),
    clippingSamples,
    longestClippingRun,
    invalidSamples,
    durationSeconds: frameCount / Math.max(1, audio.sampleRate),
    sampleRate: audio.sampleRate,
    channels: channelCount,
  };
}
