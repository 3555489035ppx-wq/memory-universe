import type { MemoryTemplateConfig } from '../types';

export function validateTimeline(config: Pick<MemoryTemplateConfig, 'id' | 'phases'>): void {
  let previousEnd = 0;
  for (const phase of config.phases) {
    if (!Number.isFinite(phase.start) || !Number.isFinite(phase.end) || phase.start !== previousEnd || phase.end <= phase.start) {
      throw new Error(`Invalid timeline phase in template: ${config.id}`);
    }
    previousEnd = phase.end;
  }
  if (previousEnd !== 1) throw new Error(`Timeline must end at 1: ${config.id}`);
}
