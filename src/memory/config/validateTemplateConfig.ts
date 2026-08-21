import type { MemoryTemplateConfig } from '../types';

export function validateTemplateConfig(config: MemoryTemplateConfig): void {
  if (config.id.trim().length === 0 || config.title.trim().length === 0 || config.durationSeconds <= 0) {
    throw new Error(`Invalid template config: ${config.id.trim().length > 0 ? config.id : 'unknown'}`);
  }
  if (config.minPhotos < 1 || config.maxPhotos < config.minPhotos) {
    throw new Error(`Invalid photo bounds for template: ${config.id}`);
  }
  if (config.phases.length === 0) throw new Error(`Template has no phases: ${config.id}`);
  const first = config.phases[0];
  const last = config.phases.at(-1);
  if (!first || first.start !== 0 || !last || last.end !== 1) {
    throw new Error(`Template phases must cover 0..1: ${config.id}`);
  }
  let previousEnd = 0;
  for (const phase of config.phases) {
    if (phase.start !== previousEnd || phase.end <= phase.start) {
      throw new Error(`Template phases overlap or have gaps: ${config.id}`);
    }
    if (phase.visibleCount !== undefined && (!Number.isInteger(phase.visibleCount) || phase.visibleCount < 1)) {
      throw new Error(`Template phase has an invalid visible count: ${config.id}/${phase.id}`);
    }
    if (phase.stagger !== undefined && (phase.stagger < 0 || phase.stagger >= 1)) {
      throw new Error(`Template phase has an invalid stagger: ${config.id}/${phase.id}`);
    }
    if (phase.settleAt !== undefined && (phase.settleAt <= 0 || phase.settleAt > 1)) {
      throw new Error(`Template phase has an invalid settle point: ${config.id}/${phase.id}`);
    }
    previousEnd = phase.end;
  }
}

export function assertValidTemplateConfig<T extends MemoryTemplateConfig>(config: T): T {
  validateTemplateConfig(config);
  return config;
}
