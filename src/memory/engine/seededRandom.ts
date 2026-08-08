import { stableHash } from '../../engine/layout/layoutTypes';

export function createSeededRandom(seed: number): () => number {
  let state = stableHash(String(seed), seed) || 1;
  return () => {
    state = Math.imul(state + 0x6d2b79f5, 1_664_525) + 1_013_904_223;
    return (state >>> 0) / 4_294_967_296;
  };
}

export function seededUnit(value: string, seed: number): number {
  return stableHash(value, seed) / 4_294_967_295;
}

export function seededSigned(value: string, seed: number): number {
  return seededUnit(value, seed) * 2 - 1;
}

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}
