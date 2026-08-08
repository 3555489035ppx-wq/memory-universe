import type { EffectiveQuality } from '../../stores/settingsStore';
import type { TextureVariant } from '../textures/LocalTextureManager';

export type MemoryLod = 'far' | 'medium' | 'near' | 'focus';

interface LodThresholds {
  near: number;
  far: number;
  hysteresis: number;
}

const THRESHOLDS: Record<EffectiveQuality, LodThresholds> = {
  high: { near: 11.5, far: 20, hysteresis: 1.2 },
  medium: { near: 10, far: 18, hysteresis: 1.2 },
  low: { near: 8, far: 15, hysteresis: 1.5 },
};

export const TEXTURE_BUDGETS: Record<EffectiveQuality, number> = {
  high: 192 * 1024 * 1024,
  medium: 96 * 1024 * 1024,
  low: 48 * 1024 * 1024,
};

export const NODE_LIMITS: Record<EffectiveQuality, number> = {
  high: 150,
  medium: 100,
  low: 72,
};

function baseLod(distance: number, thresholds: LodThresholds): Exclude<MemoryLod, 'focus'> {
  if (distance <= thresholds.near) return 'near';
  if (distance <= thresholds.far) return 'medium';
  return 'far';
}

export function selectMemoryLod(
  distance: number,
  previous: MemoryLod,
  focused: boolean,
  quality: EffectiveQuality,
): MemoryLod {
  if (focused) return 'focus';
  const safeDistance = Number.isFinite(distance) ? Math.max(0, distance) : Number.POSITIVE_INFINITY;
  const thresholds = THRESHOLDS[quality];
  const fallback = baseLod(safeDistance, thresholds);
  if (previous === 'focus') return fallback;

  if (previous === 'near') {
    return safeDistance > thresholds.near + thresholds.hysteresis ? fallback : 'near';
  }
  if (previous === 'medium') {
    if (safeDistance < thresholds.near - thresholds.hysteresis) return 'near';
    if (safeDistance > thresholds.far + thresholds.hysteresis) return 'far';
    return 'medium';
  }
  return safeDistance < thresholds.far - thresholds.hysteresis ? fallback : 'far';
}

export function textureVariantForLod(lod: MemoryLod): TextureVariant | null {
  if (lod === 'medium') return 'micro';
  if (lod === 'near') return 'thumbnail';
  if (lod === 'focus') return 'preview';
  return null;
}
