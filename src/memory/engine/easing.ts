import type { TimelinePhase } from '../types';

export function applyEasing(value: number, easing: TimelinePhase['easing'] = 'ease-in-out'): number {
  const t = Math.min(1, Math.max(0, value));
  if (easing === 'linear') return t;
  if (easing === 'ease-in') return t * t;
  if (easing === 'ease-out') return 1 - (1 - t) ** 2;
  if (easing === 'cinematic') return t * t * t * (t * (t * 6 - 15) + 10);
  if (easing === 'expo-out') return t >= 1 ? 1 : 1 - 2 ** (-10 * t);
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

export function shortestAngle(from: number, to: number, progress: number): number {
  const difference = ((to - from + Math.PI) % (Math.PI * 2)) - Math.PI;
  return from + difference * progress;
}
