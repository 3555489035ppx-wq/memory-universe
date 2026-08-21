import { analyzePcm, type LoudnessMetrics, type PcmAudioData } from '../music/loudnessMeter';
import { dbToGain, getAudioPreset, type AudioPresetId } from '../music/audioPresets';

export interface MasteredAudioResult {
  audioBuffer: AudioBuffer;
  inputMetrics: LoudnessMetrics;
  outputMetrics: LoudnessMetrics;
  presetId: AudioPresetId;
  normalizationGainDb: number;
  correctionGainDb: number;
}

export interface AudioRenderOptions {
  presetId: AudioPresetId;
  signal?: AbortSignal;
  onProgress?: (progress: number, label: string) => void;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('Audio rendering cancelled.', 'AbortError');
}

function pcmFromAudioBuffer(buffer: AudioBuffer): PcmAudioData {
  return {
    channels: Array.from({ length: buffer.numberOfChannels }, (_, channel) => buffer.getChannelData(channel)),
    sampleRate: buffer.sampleRate,
  };
}

export function applyGainInPlace(channels: readonly Float32Array[], gainDb: number): void {
  const gain = dbToGain(gainDb);
  for (const channel of channels) {
    for (let frame = 0; frame < channel.length; frame += 1) {
      channel[frame] = (channel[frame] ?? 0) * gain;
    }
  }
}

/**
 * 4× inter-sample peak estimator with instant attack and a musical release.
 * A final global ceiling correction guarantees the measured result never
 * exceeds the configured ceiling, even for pathological input.
 */
export function applyTruePeakLimiterInPlace(
  channels: readonly Float32Array[],
  sampleRate: number,
  ceilingDbtp = -1,
  oversampling = 4,
): number {
  if (channels.length === 0) return 0;
  const frameCount = Math.min(...channels.map((channel) => channel.length));
  const ceiling = dbToGain(ceilingDbtp);
  const previous = new Float64Array(channels.length);
  const releaseCoefficient = 1 - Math.exp(-1 / (Math.max(1, sampleRate) * 0.075));
  let gain = 1;
  let minimumGain = 1;

  for (let frame = 0; frame < frameCount; frame += 1) {
    let peak = 0;
    for (let channelIndex = 0; channelIndex < channels.length; channelIndex += 1) {
      const sample = channels[channelIndex]?.[frame] ?? 0;
      const prior = previous[channelIndex] ?? 0;
      for (let step = 1; step <= Math.max(1, oversampling); step += 1) {
        peak = Math.max(peak, Math.abs(prior + (sample - prior) * (step / Math.max(1, oversampling))));
      }
      previous[channelIndex] = sample;
    }
    const desired = peak > ceiling ? ceiling / Math.max(peak, 1e-12) : 1;
    gain = desired < gain ? desired : gain + (1 - gain) * releaseCoefficient;
    minimumGain = Math.min(minimumGain, gain);
    for (const channel of channels) channel[frame] = (channel[frame] ?? 0) * gain;
  }

  const measured = analyzePcm({ channels, sampleRate });
  if (measured.maximumTruePeakDbtp > ceilingDbtp) {
    applyGainInPlace(channels, ceilingDbtp - measured.maximumTruePeakDbtp - 0.01);
  }
  return minimumGain > 0 ? -20 * Math.log10(minimumGain) : 120;
}

async function renderPreset(
  input: AudioBuffer,
  presetId: AudioPresetId,
  normalizationGainDb: number,
  signal?: AbortSignal,
): Promise<AudioBuffer> {
  throwIfAborted(signal);
  const preset = getAudioPreset(presetId);
  const sampleRate = preset.processingSampleRate;
  const frameCount = Math.max(1, Math.ceil(input.duration * sampleRate));
  const offline = new OfflineAudioContext(2, frameCount, sampleRate);
  const source = offline.createBufferSource();
  source.buffer = input;

  if (preset.bypass) {
    source.connect(offline.destination);
  } else {
    const inputGain = offline.createGain();
    inputGain.gain.value = dbToGain(preset.inputHeadroomDb);
    const highPass = offline.createBiquadFilter();
    highPass.type = 'highpass';
    highPass.frequency.value = 28;
    highPass.Q.value = 0.707;
    source.connect(inputGain);
    inputGain.connect(highPass);
    let previous: AudioNode = highPass;
    for (const band of preset.eqBands) {
      const filter = offline.createBiquadFilter();
      filter.type = band.type;
      filter.frequency.value = band.frequency;
      filter.gain.value = band.gain;
      filter.Q.value = band.q;
      previous.connect(filter);
      previous = filter;
    }
    const compressor = offline.createDynamicsCompressor();
    compressor.threshold.value = preset.compressor.threshold;
    compressor.knee.value = preset.compressor.knee;
    compressor.ratio.value = preset.compressor.ratio;
    compressor.attack.value = preset.compressor.attack;
    compressor.release.value = preset.compressor.release;
    const outputGain = offline.createGain();
    outputGain.gain.value = dbToGain(preset.makeupGainDb + normalizationGainDb);
    previous.connect(compressor);
    compressor.connect(outputGain);
    outputGain.connect(offline.destination);
  }
  source.start(0);
  const rendered = await offline.startRendering();
  throwIfAborted(signal);
  return rendered;
}

export async function renderMasteredAudio(
  input: AudioBuffer,
  options: AudioRenderOptions,
): Promise<MasteredAudioResult> {
  const preset = getAudioPreset(options.presetId);
  options.onProgress?.(0.08, '分析原始音频');
  const inputMetrics = analyzePcm(pcmFromAudioBuffer(input));
  throwIfAborted(options.signal);
  const normalizationGainDb = preset.bypass
    ? 0
    : clamp(preset.targetIntegratedLufs - inputMetrics.integratedLufs, -preset.maxAutoGainDb, preset.maxAutoGainDb);
  options.onProgress?.(0.3, '离线应用 EQ 与动态处理');
  const rendered = await renderPreset(input, options.presetId, normalizationGainDb, options.signal);
  const channels = pcmFromAudioBuffer(rendered).channels;
  if (!preset.bypass) {
    options.onProgress?.(0.72, '执行 4× 峰值保护');
    applyTruePeakLimiterInPlace(channels, rendered.sampleRate, preset.limiter.ceilingDbtp, preset.limiter.oversampling);
  }

  let outputMetrics = analyzePcm(pcmFromAudioBuffer(rendered));
  let correctionGainDb = 0;
  if (!preset.bypass && Math.abs(outputMetrics.integratedLufs - preset.targetIntegratedLufs) > 1) {
    const loudnessCorrection = clamp(
      preset.targetIntegratedLufs - outputMetrics.integratedLufs,
      -2,
      2,
    );
    const peakHeadroom = preset.limiter.ceilingDbtp - outputMetrics.maximumTruePeakDbtp;
    correctionGainDb = Math.min(loudnessCorrection, peakHeadroom);
    if (Math.abs(correctionGainDb) > 0.05) {
      applyGainInPlace(channels, correctionGainDb);
      applyTruePeakLimiterInPlace(channels, rendered.sampleRate, preset.limiter.ceilingDbtp, preset.limiter.oversampling);
      outputMetrics = analyzePcm(pcmFromAudioBuffer(rendered));
    }
  }
  options.onProgress?.(1, '音频母带完成');
  return {
    audioBuffer: rendered,
    inputMetrics,
    outputMetrics,
    presetId: options.presetId,
    normalizationGainDb,
    correctionGainDb,
  };
}

export async function decodeAndMasterAudio(
  blob: Blob,
  options: AudioRenderOptions,
): Promise<MasteredAudioResult> {
  throwIfAborted(options.signal);
  options.onProgress?.(0.02, '解码本地音频');
  const context = new AudioContext({ sampleRate: 48_000 });
  try {
    const bytes = await blob.arrayBuffer();
    throwIfAborted(options.signal);
    const decoded = await context.decodeAudioData(bytes);
    return await renderMasteredAudio(decoded, options);
  } finally {
    await context.close();
  }
}

/**
 * Produces the exact song range used by the timeline. Missing tail samples are
 * intentionally silent instead of stretching or repeating audio, so video and
 * music remain frame-accurate even when container metadata is imprecise.
 */
export function trimAudioBuffer(
  input: AudioBuffer,
  startSeconds: number,
  durationSeconds: number,
): AudioBuffer {
  const sampleRate = Math.max(1, input.sampleRate);
  const startFrame = clamp(Math.floor(Math.max(0, startSeconds) * sampleRate), 0, input.length);
  const targetFrames = Math.max(1, Math.round(Math.max(0.001, durationSeconds) * sampleRate));
  const output = new AudioBuffer({
    length: targetFrames,
    numberOfChannels: Math.max(1, input.numberOfChannels),
    sampleRate,
  });
  for (let channel = 0; channel < output.numberOfChannels; channel += 1) {
    const source = input.getChannelData(Math.min(channel, input.numberOfChannels - 1));
    const target = output.getChannelData(channel);
    target.set(source.subarray(startFrame, startFrame + targetFrames));
  }
  return output;
}

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let index = 0; index < text.length; index += 1) view.setUint8(offset + index, text.charCodeAt(index));
}

/** Encodes a deterministic 24-bit PCM WAV archive master. */
export function encodeWav24(audio: PcmAudioData): Blob {
  const channels = Math.max(1, audio.channels.length);
  const frameCount = audio.channels.length > 0 ? Math.min(...audio.channels.map((channel) => channel.length)) : 0;
  const bytesPerSample = 3;
  const dataLength = frameCount * channels * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);
  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, audio.sampleRate, true);
  view.setUint32(28, audio.sampleRate * channels * bytesPerSample, true);
  view.setUint16(32, channels * bytesPerSample, true);
  view.setUint16(34, 24, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataLength, true);
  let offset = 44;
  let random = 0x5f37_59df;
  for (let frame = 0; frame < frameCount; frame += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      random ^= random << 13;
      random ^= random >>> 17;
      random ^= random << 5;
      const first = (random >>> 0) / 0xffff_ffff;
      random ^= random << 13;
      random ^= random >>> 17;
      random ^= random << 5;
      const second = (random >>> 0) / 0xffff_ffff;
      const dither = (first - second) / 8_388_607;
      const sample = clamp((audio.channels[channel]?.[frame] ?? audio.channels[0]?.[frame] ?? 0) + dither, -1, 1);
      const integer = Math.round(sample * (sample < 0 ? 8_388_608 : 8_388_607));
      view.setUint8(offset, integer & 0xff);
      view.setUint8(offset + 1, (integer >> 8) & 0xff);
      view.setUint8(offset + 2, (integer >> 16) & 0xff);
      offset += 3;
    }
  }
  return new Blob([buffer], { type: 'audio/wav' });
}
