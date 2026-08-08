import type { MemoryTemplateConfig } from '../types';
import { assertValidTemplateConfig } from './validateTemplateConfig';

export const loveTemplate = assertValidTemplateConfig<MemoryTemplateConfig>({
  id: 'love',
  title: '与你有关',
  category: '关系记忆',
  description: '两条靠近的轨道，最后汇成一颗完整的心。',
  durationSeconds: 42,
  available: true,
  layout: 'heart',
  seed: 2_026_080_6,
  minPhotos: 1,
  maxPhotos: 60,
  phases: [
    { id: 'first-sight', start: 0, end: 0.2, layout: 'scattered', label: '初见', camera: 'wide' },
    { id: 'approach', start: 0.2, end: 0.5, layout: 'heart', label: '靠近', camera: 'approach' },
    { id: 'heart', start: 0.5, end: 0.82, layout: 'heart', label: '完整', camera: 'hero' },
    { id: 'afterglow', start: 0.82, end: 1, layout: 'heart', label: '余温', camera: 'pullback' },
  ],
});
