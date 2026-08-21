export const FAREWELL_DURATION_SECONDS = 6.8;
export const FAREWELL_TEXT = '\u518D\u89C1\u4E86\uFF0C\u6211\u4EEC\u7684\u9752\u6625';

export type FarewellStage =
  | 'idle'
  | 'preparing'
  | 'dissolving'
  | 'gathering'
  | 'text-hold'
  | 'tail'
  | 'completed';

export interface FarewellSequenceState {
  active: boolean;
  stage: FarewellStage;
  localTime: number;
  progress: number;
  backgroundDim: number;
  photoOpacity: number;
  particleOpacity: number;
  particleGather: number;
  particleTextOpacity: number;
  particleExplosion: number;
  /** Backwards-compatible alias used by the frame renderer as the burst amount. */
  particleTail: number;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function smoothstep(value: number): number {
  const clamped = clamp01(value);
  return clamped * clamped * (3 - 2 * clamped);
}

function between(value: number, start: number, end: number): number {
  return smoothstep((value - start) / Math.max(0.001, end - start));
}

/**
 * Absolute-time farewell state shared by preview and frame export.
 *
 * Narrative beats:
 * 1. photos dim and release their edge particles;
 * 2. particles gather into the farewell copy;
 * 3. the copy holds long enough to read;
 * 4. the copy explodes outward and fades into the starfield.
 */
export function evaluateFarewellSequence(
  elapsedSeconds: number,
  durationSeconds: number,
  reducedMotion = false,
): FarewellSequenceState {
  const safeDuration = Math.max(0.001, Number.isFinite(durationSeconds) ? durationSeconds : 0.001);
  const sequenceDuration = Math.min(
    FAREWELL_DURATION_SECONDS,
    safeDuration,
    Math.max(2.8, safeDuration * 0.68),
  );
  const start = Math.max(0, safeDuration - sequenceDuration);
  const safeElapsed = Math.min(safeDuration, Math.max(0, Number.isFinite(elapsedSeconds) ? elapsedSeconds : 0));
  if (safeElapsed < start) {
    return {
      active: false,
      stage: 'idle',
      localTime: 0,
      progress: 0,
      backgroundDim: 0,
      photoOpacity: 1,
      particleOpacity: 0,
      particleGather: 0,
      particleTextOpacity: 0,
      particleExplosion: 0,
      particleTail: 0,
    };
  }

  const scale = sequenceDuration / FAREWELL_DURATION_SECONDS;
  const localTime = (safeElapsed - start) / Math.max(0.001, scale);
  const progress = clamp01(localTime / FAREWELL_DURATION_SECONDS);
  const stage: FarewellStage = localTime < 1
    ? 'preparing'
    : localTime < 2.6
      ? 'dissolving'
      : localTime < 4
        ? 'gathering'
        : localTime < 5.8
          ? 'text-hold'
          : localTime < 6.8
            ? 'tail'
            : 'completed';

  const dissolve = between(localTime, 0.9, 2.65);
  const gather = reducedMotion ? 0.18 * between(localTime, 2.05, 3.95) : between(localTime, 2.05, 3.95);
  const particleIn = between(localTime, 0.72, 1.42);
  const textIn = between(localTime, 2.2, 3.18);
  const explosion = between(localTime, 5.45, 6.68);
  const explosionFade = between(localTime, 6.02, 6.8);
  const baseParticleOpacity = reducedMotion ? 0.34 : 0.82;

  return {
    active: stage !== 'completed',
    stage,
    localTime,
    progress,
    backgroundDim: 0.56 * between(localTime, 0, 2.8) * (1 - 0.42 * explosion),
    photoOpacity: 1 - dissolve,
    particleOpacity: baseParticleOpacity * particleIn * (1 - explosionFade),
    particleGather: gather,
    particleTextOpacity: textIn * (1 - explosion),
    particleExplosion: explosion,
    particleTail: explosion,
  };
}
