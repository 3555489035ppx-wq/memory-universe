interface WorkletParameterDescriptor {
  name: string;
  defaultValue: number;
  minValue: number;
  maxValue: number;
  automationRate: 'a-rate' | 'k-rate';
}

declare const sampleRate: number;
declare abstract class AudioWorkletProcessor {
  readonly port: MessagePort;
}
declare function registerProcessor(
  name: string,
  processorCtor: new () => AudioWorkletProcessor,
): void;

class MementoTruePeakLimiter extends AudioWorkletProcessor {
  static get parameterDescriptors(): WorkletParameterDescriptor[] {
    return [{ name: 'ceilingDb', defaultValue: -1, minValue: -12, maxValue: 0, automationRate: 'k-rate' }];
  }

  #delayLines: Float32Array[] = [];
  #previousSamples: number[] = [];
  #writeIndex = 0;
  #gain = 1;
  #meterFrames = 0;
  #meterPeak = 0;
  #meterMinGain = 1;
  readonly #lookaheadSamples = Math.max(1, Math.round(sampleRate * 0.005));
  readonly #releaseCoefficient = 1 - Math.exp(-1 / (sampleRate * 0.075));

  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>,
  ): boolean {
    const input = inputs[0];
    const output = outputs[0];
    const frameCount = output?.[0]?.length ?? 0;
    if (!input || !output || frameCount === 0) return true;
    while (this.#delayLines.length < output.length) {
      this.#delayLines.push(new Float32Array(this.#lookaheadSamples));
      this.#previousSamples.push(0);
    }
    const ceilingDb = parameters.ceilingDb?.[0] ?? -1;
    const ceiling = 10 ** (ceilingDb / 20);

    for (let frame = 0; frame < frameCount; frame += 1) {
      let truePeak = 0;
      for (let channel = 0; channel < output.length; channel += 1) {
        const sample = input[channel]?.[frame] ?? input[0]?.[frame] ?? 0;
        const previous = this.#previousSamples[channel] ?? 0;
        for (let step = 1; step <= 4; step += 1) {
          const interpolated = previous + (sample - previous) * (step / 4);
          truePeak = Math.max(truePeak, Math.abs(interpolated));
        }
        this.#previousSamples[channel] = sample;
      }

      const desiredGain = truePeak > ceiling ? ceiling / Math.max(truePeak, 1e-9) : 1;
      this.#gain = desiredGain < this.#gain
        ? desiredGain
        : this.#gain + (1 - this.#gain) * this.#releaseCoefficient;
      for (let channel = 0; channel < output.length; channel += 1) {
        const delayLine = this.#delayLines[channel];
        const outputChannel = output[channel];
        if (!delayLine || !outputChannel) continue;
        const sample = input[channel]?.[frame] ?? input[0]?.[frame] ?? 0;
        const delayed = delayLine[this.#writeIndex] ?? 0;
        delayLine[this.#writeIndex] = sample;
        outputChannel[frame] = delayed * this.#gain;
      }
      this.#writeIndex = (this.#writeIndex + 1) % this.#lookaheadSamples;
      this.#meterPeak = Math.max(this.#meterPeak, truePeak * this.#gain);
      this.#meterMinGain = Math.min(this.#meterMinGain, this.#gain);
      this.#meterFrames += 1;
    }

    if (this.#meterFrames >= sampleRate / 10) {
      this.port.postMessage({
        truePeak: this.#meterPeak,
        reductionDb: this.#meterMinGain > 0 ? -20 * Math.log10(this.#meterMinGain) : 120,
      });
      this.#meterFrames = 0;
      this.#meterPeak = 0;
      this.#meterMinGain = 1;
    }
    return true;
  }
}

registerProcessor('memento-true-peak-limiter', MementoTruePeakLimiter);

export {};
