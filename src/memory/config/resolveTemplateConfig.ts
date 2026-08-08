import type { MemoryTemplateConfig, TemplateSessionOverrides } from '../types';
import { validateTimeline } from '../engine/validateTimeline';

/** Apply user/session overrides without mutating the registered template. */
export function resolveTemplateConfig(
  config: MemoryTemplateConfig,
  overrides: TemplateSessionOverrides | undefined,
): MemoryTemplateConfig {
  if (!overrides) return config;
  const phases = config.phases.map((phase) => ({
    ...phase,
    ...(overrides.phaseOverrides?.[phase.id] ?? {}),
  }));
  const resolved: MemoryTemplateConfig = {
    ...config,
    layout: overrides.layoutPreset ?? config.layout,
    phases,
  };
  validateTimeline(resolved);
  return resolved;
}
