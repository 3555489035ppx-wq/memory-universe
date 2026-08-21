import type { MemoryTemplateConfig } from '../types';
import { assertValidTemplateConfig } from './validateTemplateConfig';

export const careerTemplate = assertValidTemplateConfig<MemoryTemplateConfig>({
  id: 'career',
  title: '向前',
  category: '成长轨迹',
  description: '时间向上延伸，每一个里程碑都保留前方。',
  durationSeconds: 50,
  available: false,
  layout: 'helix',
  seed: 2_026_080_9,
  minPhotos: 24,
  maxPhotos: 96,
  phases: [
    { id: 'origin', start: 0, end: 0.2, layout: 'scattered', label: '起点', camera: 'wide' },
    { id: 'rise', start: 0.2, end: 0.58, layout: 'helix', label: '向上', camera: 'approach' },
    { id: 'milestones', start: 0.58, end: 0.84, layout: 'galaxy', label: '里程碑', camera: 'hero' },
    { id: 'forward', start: 0.84, end: 1, layout: 'helix', label: '继续向前', camera: 'pullback' },
  ],
});
