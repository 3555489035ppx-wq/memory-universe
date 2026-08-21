import { describe, expect, it } from 'vitest';

import { analyzePcm } from '../music/loudnessMeter';
import { applyTruePeakLimiterInPlace, encodeWav24, trimAudioBuffer } from './audioRender';

describe('offline audio rendering helpers', () => {
  it('limits dangerous transients below the -1 dBTP ceiling without invalid samples', () => {
    const channel = new Float32Array(48_000);
    channel[1_000] = 1.4;
    channel[1_001] = -1.25;
    applyTruePeakLimiterInPlace([channel], 48_000, -1, 4);
    const metrics = analyzePcm({ channels: [channel], sampleRate: 48_000 });
    expect(metrics.maximumTruePeakDbtp).toBeLessThanOrEqual(-1);
    expect(metrics.clippingSamples).toBe(0);
    expect(metrics.invalidSamples).toBe(0);
  });

  it('writes a valid 24-bit 48kHz stereo WAV header and payload', async () => {
    const wav = encodeWav24({
      channels: [new Float32Array([0, 0.5]), new Float32Array([0, -0.5])],
      sampleRate: 48_000,
    });
    const wavBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error ?? new Error('WAV_READ_FAILED'));
      reader.readAsArrayBuffer(wav);
    });
    const bytes = new Uint8Array(wavBuffer);
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe('RIFF');
    expect(new TextDecoder().decode(bytes.slice(8, 12))).toBe('WAVE');
    expect(new DataView(bytes.buffer).getUint16(22, true)).toBe(2);
    expect(new DataView(bytes.buffer).getUint32(24, true)).toBe(48_000);
    expect(new DataView(bytes.buffer).getUint16(34, true)).toBe(24);
    expect(bytes.byteLength).toBe(44 + 2 * 2 * 3);
  });

  it('trims the selected song cue without time-stretching and pads only a missing tail with silence', () => {
    class FakeAudioBuffer {
      readonly length: number;
      readonly numberOfChannels: number;
      readonly sampleRate: number;
      #channels: Float32Array[];

      constructor(options: AudioBufferOptions) {
        this.length = options.length;
        this.numberOfChannels = options.numberOfChannels ?? 1;
        this.sampleRate = options.sampleRate;
        this.#channels = Array.from({ length: this.numberOfChannels }, () => new Float32Array(this.length));
      }

      getChannelData(channel: number): Float32Array {
        return this.#channels[channel] ?? this.#channels[0] ?? new Float32Array(0);
      }
    }

    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'AudioBuffer');
    Object.defineProperty(globalThis, 'AudioBuffer', { configurable: true, value: FakeAudioBuffer });
    try {
      const input = new FakeAudioBuffer({ length: 8, numberOfChannels: 1, sampleRate: 4 });
      input.getChannelData(0).set([0, 1, 2, 3, 4, 5, 6, 7]);
      const trimmed = trimAudioBuffer(input as unknown as AudioBuffer, 1, 2) as unknown as FakeAudioBuffer;
      expect([...trimmed.getChannelData(0)]).toEqual([4, 5, 6, 7, 0, 0, 0, 0]);
    } finally {
      if (descriptor) Object.defineProperty(globalThis, 'AudioBuffer', descriptor);
      else Reflect.deleteProperty(globalThis, 'AudioBuffer');
    }
  });
});
