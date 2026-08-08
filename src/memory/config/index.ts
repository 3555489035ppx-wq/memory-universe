import type { MemoryTemplateConfig, MemoryTemplateId } from '../types';
import { breakupTemplate } from './breakup';
import { careerTemplate } from './career';
import { highSchoolTemplate } from './high-school';
import { loveTemplate } from './love';
import { universityTemplate } from './university';

export const memoryTemplates: readonly MemoryTemplateConfig[] = [
  highSchoolTemplate,
  loveTemplate,
  breakupTemplate,
  universityTemplate,
  careerTemplate,
];

export function getMemoryTemplate(id: MemoryTemplateId): MemoryTemplateConfig {
  const template = memoryTemplates.find((candidate) => candidate.id === id);
  if (!template) throw new Error(`Unknown memory template: ${id}`);
  return template;
}

export { resolveTemplateConfig } from './resolveTemplateConfig';
