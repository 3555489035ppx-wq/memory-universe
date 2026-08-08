import type { EffectiveQuality } from '../stores/settingsStore';

const QUALITY_ORDER: EffectiveQuality[] = ['low', 'medium', 'high'];

export function initialAutoQuality(
  dpr: number,
  deviceMemory: number | undefined,
): EffectiveQuality {
  if ((deviceMemory !== undefined && deviceMemory <= 4) || dpr > 2.2) return 'low';
  if (deviceMemory !== undefined && deviceMemory >= 12 && dpr <= 1.5) return 'high';
  return 'medium';
}

export function adjacentQuality(
  current: EffectiveQuality,
  direction: 'up' | 'down',
): EffectiveQuality {
  const index = QUALITY_ORDER.indexOf(current);
  const offset = direction === 'up' ? 1 : -1;
  const bounded = Math.max(0, Math.min(QUALITY_ORDER.length - 1, index + offset));
  return QUALITY_ORDER[bounded] ?? current;
}
