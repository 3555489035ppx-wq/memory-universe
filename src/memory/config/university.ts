import type { MemoryTemplateConfig } from '../types';
import { assertValidTemplateConfig } from './validateTemplateConfig';

export const universityTemplate = assertValidTemplateConfig<MemoryTemplateConfig>({
  id: 'university',
  title: '我们的明天',
  category: '大学生活',
  description: '学习、朋友与生活三条轨道，在同一片星系里继续生长。',
  durationSeconds: 52,
  available: true,
  layout: 'galaxy',
  seed: 2_026_080_8,
  minPhotos: 1,
  maxPhotos: 60,
  phases: [
    { id: 'arrival', start: 0, end: 0.18, layout: 'scattered', label: '抵达', camera: 'wide' },
    { id: 'learning', start: 0.18, end: 0.48, layout: 'galaxy', label: '学习', camera: 'approach' },
    { id: 'friends', start: 0.48, end: 0.72, layout: 'galaxy', label: '朋友', camera: 'hero' },
    { id: 'life', start: 0.72, end: 0.9, layout: 'galaxy', label: '生活', camera: 'approach' },
    { id: 'system', start: 0.9, end: 1, layout: 'galaxy', label: '星系', camera: 'pullback' },
  ],
});
