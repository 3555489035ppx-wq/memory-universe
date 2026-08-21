import { createAudioMeterSnapshot, type AudioMeterSnapshot } from './audioMeter';
import { dbToGain, getAudioPreset, type AudioPresetId } from './audioPresets';

export type LimiterRuntimeStatus = 'loading' | 'ready' | 'fallback' | 'error';

interface LimiterMessage {
  truePeak?: number;
  reductionDb?: number;
}

export class StudioAudioGraph {
  readonly context: AudioContext;
  readonly analyser: AnalyserNode;
  readonly compressor: DynamicsCompressorNode;

  #source: MediaElementAudioSourceNode;
  #dryGain: GainNode;
  #inputGain: GainNode;
  #highPass: BiquadFilterNode;
  #eq: readonly BiquadFilterNode[];
  #makeupGain: GainNode;
  #limiterInput: GainNode;
  #fallbackLimiter: DynamicsCompressorNode;
  #wetGain: GainNode;
  #masterGain: GainNode;
  #limiterNode: AudioWorkletNode | null = null;
  #limiterStatus: LimiterRuntimeStatus = 'loading';
  #limiterMeter = { truePeak: 0, reductionDb: 0, ready: false };
  #meterBuffer: Float32Array<ArrayBuffer>;
  #selectedPreset: AudioPresetId = 'clarity-v1';
  #auditionBypass = false;
  #disposed = false;

  constructor(context: AudioContext, media: HTMLMediaElement) {
    this.context = context;
    this.#source = context.createMediaElementSource(media);
    this.#dryGain = context.createGain();
    this.#inputGain = context.createGain();
    this.#highPass = context.createBiquadFilter();
    this.#highPass.type = 'highpass';
    this.#highPass.frequency.value = 28;
    this.#highPass.Q.value = 0.707;
    this.#eq = Array.from({ length: 4 }, () => context.createBiquadFilter());
    this.compressor = context.createDynamicsCompressor();
    this.#makeupGain = context.createGain();
    this.#limiterInput = context.createGain();
    this.#fallbackLimiter = context.createDynamicsCompressor();
    this.#fallbackLimiter.threshold.value = -2.2;
    this.#fallbackLimiter.knee.value = 0;
    this.#fallbackLimiter.ratio.value = 20;
    this.#fallbackLimiter.attack.value = 0.001;
    this.#fallbackLimiter.release.value = 0.065;
    this.#wetGain = context.createGain();
    this.#masterGain = context.createGain();
    this.analyser = context.createAnalyser();
    this.analyser.fftSize = 512;
    this.analyser.smoothingTimeConstant = 0.82;
    this.#meterBuffer = new Float32Array(this.analyser.fftSize);

    this.#source.connect(this.#dryGain);
    this.#source.connect(this.#inputGain);
    this.#inputGain.connect(this.#highPass);
    let previous: AudioNode = this.#highPass;
    for (const filter of this.#eq) {
      previous.connect(filter);
      previous = filter;
    }
    previous.connect(this.compressor);
    this.compressor.connect(this.#makeupGain);
    this.#makeupGain.connect(this.#limiterInput);
    this.#limiterInput.connect(this.#fallbackLimiter);
    this.#fallbackLimiter.connect(this.#wetGain);
    this.#dryGain.connect(this.#masterGain);
    this.#wetGain.connect(this.#masterGain);
    this.#masterGain.connect(this.analyser);
    this.analyser.connect(context.destination);
    this.setPreset(this.#selectedPreset, true);
  }

  get limiterStatus(): LimiterRuntimeStatus {
    return this.#limiterStatus;
  }

  get selectedPreset(): AudioPresetId {
    return this.#selectedPreset;
  }

  async initializeLimiter(moduleUrl: URL): Promise<LimiterRuntimeStatus> {
    if (typeof AudioWorkletNode === 'undefined') {
      this.#limiterStatus = 'fallback';
      return this.#limiterStatus;
    }
    let rewired = false;
    try {
      await this.context.audioWorklet.addModule(moduleUrl);
      if (this.#disposed) return 'error';
      const limiter = new AudioWorkletNode(this.context, 'memento-true-peak-limiter', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [2],
        parameterData: { ceilingDb: -1 },
      });
      limiter.port.onmessage = (event: MessageEvent<LimiterMessage>) => {
        this.#limiterMeter.truePeak = Math.max(0, event.data.truePeak ?? 0);
        this.#limiterMeter.reductionDb = Math.max(0, event.data.reductionDb ?? 0);
        this.#limiterMeter.ready = true;
      };
      this.#limiterInput.disconnect();
      this.#fallbackLimiter.disconnect();
      rewired = true;
      this.#limiterInput.connect(limiter);
      limiter.connect(this.#wetGain);
      this.#limiterNode = limiter;
      this.#limiterStatus = 'ready';
      this.setPreset(this.#selectedPreset, true);
    } catch {
      if (!this.#disposed) {
        if (rewired) {
          this.#limiterInput.disconnect();
          this.#limiterInput.connect(this.#fallbackLimiter);
          this.#fallbackLimiter.connect(this.#wetGain);
        }
        this.#limiterStatus = 'fallback';
      }
    }
    return this.#limiterStatus;
  }

  setPreset(id: AudioPresetId, immediate = false): void {
    this.#selectedPreset = id;
    const preset = getAudioPreset(id);
    const now = this.context.currentTime;
    const transition = immediate ? 0.005 : 0.12;
    const apply = (parameter: AudioParam, value: number): void => {
      parameter.cancelScheduledValues(now);
      parameter.setTargetAtTime(value, now, Math.max(0.001, transition / 4));
    };
    apply(this.#inputGain.gain, dbToGain(preset.inputHeadroomDb));
    apply(this.#makeupGain.gain, dbToGain(preset.makeupGainDb));
    preset.eqBands.forEach((band, index) => {
      const filter = this.#eq[index];
      if (!filter) return;
      filter.type = band.type;
      apply(filter.frequency, band.frequency);
      apply(filter.gain, band.gain);
      apply(filter.Q, band.q);
    });
    apply(this.compressor.threshold, preset.compressor.threshold);
    apply(this.compressor.knee, preset.compressor.knee);
    apply(this.compressor.ratio, preset.compressor.ratio);
    apply(this.compressor.attack, preset.compressor.attack);
    apply(this.compressor.release, preset.compressor.release);
    const ceiling = this.#limiterNode?.parameters.get('ceilingDb');
    if (ceiling) apply(ceiling, preset.limiter.ceilingDbtp);
    this.#applyMix(transition);
  }

  setAuditionBypass(bypass: boolean): void {
    this.#auditionBypass = bypass;
    this.#applyMix(0.1);
  }

  setOutputGain(value: number, transitionSeconds = 0.08): void {
    const now = this.context.currentTime;
    const target = Math.min(1, Math.max(0, value));
    this.#masterGain.gain.cancelScheduledValues(now);
    this.#masterGain.gain.setTargetAtTime(target, now, Math.max(0.001, transitionSeconds / 4));
  }

  rampOutputGain(value: number, durationSeconds: number): void {
    const now = this.context.currentTime;
    const target = Math.min(1, Math.max(0, value));
    this.#masterGain.gain.cancelScheduledValues(now);
    this.#masterGain.gain.setValueAtTime(this.#masterGain.gain.value, now);
    this.#masterGain.gain.linearRampToValueAtTime(target, now + Math.max(0.001, durationSeconds));
  }

  cancelOutputAutomation(): void {
    const now = this.context.currentTime;
    if (typeof this.#masterGain.gain.cancelAndHoldAtTime === 'function') {
      this.#masterGain.gain.cancelAndHoldAtTime(now);
    } else {
      const current = this.#masterGain.gain.value;
      this.#masterGain.gain.cancelScheduledValues(now);
      this.#masterGain.gain.setValueAtTime(current, now);
    }
  }

  readMeter(): AudioMeterSnapshot {
    this.analyser.getFloatTimeDomainData(this.#meterBuffer);
    return createAudioMeterSnapshot(
      this.#meterBuffer,
      this.compressor.reduction,
      this.#limiterMeter,
    );
  }

  connectProcessedOutput(destination: AudioNode): () => void {
    this.#masterGain.connect(destination);
    return () => this.#masterGain.disconnect(destination);
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#source.disconnect();
    this.#dryGain.disconnect();
    this.#inputGain.disconnect();
    this.#highPass.disconnect();
    for (const filter of this.#eq) filter.disconnect();
    this.compressor.disconnect();
    this.#makeupGain.disconnect();
    this.#limiterInput.disconnect();
    this.#fallbackLimiter.disconnect();
    this.#limiterNode?.disconnect();
    this.#wetGain.disconnect();
    this.#masterGain.disconnect();
    this.analyser.disconnect();
  }

  #applyMix(transitionSeconds: number): void {
    const preset = getAudioPreset(this.#selectedPreset);
    const bypass = this.#auditionBypass || preset.bypass;
    const now = this.context.currentTime;
    for (const [parameter, value] of [
      [this.#dryGain.gain, bypass ? 1 : 0],
      [this.#wetGain.gain, bypass ? 0 : 1],
    ] as const) {
      parameter.cancelScheduledValues(now);
      parameter.setTargetAtTime(value, now, Math.max(0.001, transitionSeconds / 4));
    }
  }
}
