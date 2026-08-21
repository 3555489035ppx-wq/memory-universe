export type AudioPresetId = 'original' | 'clarity-v1' | 'studio-master-v1';

export interface EqBand {
  type: BiquadFilterType;
  frequency: number;
  gain: number;
  q: number;
}

export interface CompressorSettings {
  threshold: number;
  knee: number;
  ratio: number;
  attack: number;
  release: number;
}

export interface StudioMasterPreset {
  id: AudioPresetId;
  label: string;
  description: string;
  processingSampleRate: 48_000;
  inputHeadroomDb: number;
  eqBands: readonly [EqBand, EqBand, EqBand, EqBand];
  compressor: CompressorSettings;
  limiter: { ceilingDbtp: -1; oversampling: 4 };
  targetIntegratedLufs: -14;
  maxAutoGainDb: 6;
  makeupGainDb: number;
  bypass: boolean;
  output: {
    mobile: { codec: 'aac'; bitrate: 320_000; sampleRate: 48_000 };
    archive: { codec: 'wav'; bitDepth: 24; sampleRate: 48_000 };
  };
}

const SHARED_OUTPUT = {
  mobile: { codec: 'aac' as const, bitrate: 320_000 as const, sampleRate: 48_000 as const },
  archive: { codec: 'wav' as const, bitDepth: 24 as const, sampleRate: 48_000 as const },
};

export const AUDIO_PRESETS: Record<AudioPresetId, StudioMasterPreset> = {
  original: {
    id: 'original',
    label: '原声',
    description: '不改变音色，只保留播放器音量。',
    processingSampleRate: 48_000,
    inputHeadroomDb: 0,
    eqBands: [
      { type: 'lowshelf', frequency: 120, gain: 0, q: 0.707 },
      { type: 'peaking', frequency: 320, gain: 0, q: 0.9 },
      { type: 'peaking', frequency: 3_200, gain: 0, q: 0.85 },
      { type: 'highshelf', frequency: 9_000, gain: 0, q: 0.707 },
    ],
    compressor: { threshold: 0, knee: 0, ratio: 1, attack: 0.01, release: 0.2 },
    limiter: { ceilingDbtp: -1, oversampling: 4 },
    targetIntegratedLufs: -14,
    maxAutoGainDb: 6,
    makeupGainDb: 0,
    bypass: true,
    output: SHARED_OUTPUT,
  },
  'clarity-v1': {
    id: 'clarity-v1',
    label: '清晰',
    description: '轻减低中频浑浊，适度提升人声存在感，并保留动态。',
    processingSampleRate: 48_000,
    inputHeadroomDb: -3,
    eqBands: [
      { type: 'lowshelf', frequency: 115, gain: -0.55, q: 0.707 },
      { type: 'peaking', frequency: 310, gain: -1.15, q: 0.88 },
      { type: 'peaking', frequency: 3_100, gain: 1.05, q: 0.82 },
      { type: 'highshelf', frequency: 9_200, gain: 0.7, q: 0.707 },
    ],
    compressor: { threshold: -20, knee: 14, ratio: 1.7, attack: 0.014, release: 0.19 },
    limiter: { ceilingDbtp: -1, oversampling: 4 },
    targetIntegratedLufs: -14,
    maxAutoGainDb: 6,
    makeupGainDb: 2.25,
    bypass: false,
    output: SHARED_OUTPUT,
  },
  'studio-master-v1': {
    id: 'studio-master-v1',
    label: '录音棚级',
    description: '本地 48kHz 母带链：校正 EQ、音乐压缩、同响度增益与 4× 峰值保护。',
    processingSampleRate: 48_000,
    inputHeadroomDb: -3,
    eqBands: [
      { type: 'lowshelf', frequency: 105, gain: -0.8, q: 0.707 },
      { type: 'peaking', frequency: 285, gain: -1.35, q: 0.92 },
      { type: 'peaking', frequency: 3_350, gain: 1.2, q: 0.86 },
      { type: 'highshelf', frequency: 9_800, gain: 0.85, q: 0.707 },
    ],
    compressor: { threshold: -22, knee: 16, ratio: 2, attack: 0.018, release: 0.24 },
    limiter: { ceilingDbtp: -1, oversampling: 4 },
    targetIntegratedLufs: -14,
    maxAutoGainDb: 6,
    makeupGainDb: 2.45,
    bypass: false,
    output: SHARED_OUTPUT,
  },
};

export function getAudioPreset(id: AudioPresetId): StudioMasterPreset {
  return AUDIO_PRESETS[id];
}

export function dbToGain(db: number): number {
  return 10 ** (db / 20);
}

export function gainToDb(gain: number): number {
  return gain > 0 ? 20 * Math.log10(gain) : -120;
}
