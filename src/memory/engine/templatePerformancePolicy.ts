import type { EffectiveQuality } from '../../stores/settingsStore';

export const TEMPLATE_VISIBLE_LIMITS: Record<EffectiveQuality, number> = {
  low: 36,
  medium: 60,
  high: 96,
};

export function visiblePhotoLimit(quality: EffectiveQuality, requested: number): number {
  return Math.min(TEMPLATE_VISIBLE_LIMITS[quality], Math.max(0, requested));
}
