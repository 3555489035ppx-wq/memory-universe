import type { MemoryTemplateConfig } from '../types';
import { assertValidTemplateConfig } from './validateTemplateConfig';

export const breakupTemplate = assertValidTemplateConfig<MemoryTemplateConfig>({
  id: 'breakup',
  title: '未寄出的信',
  category: '关系记忆',
  description: '先完整回看，再逐渐分离，留下可以呼吸的空白。',
  durationSeconds: 44,
  available: true,
  layout: 'broken-heart',
  seed: 2_026_080_7,
  minPhotos: 1,
  maxPhotos: 60,
  phases: [
    { id: 'whole', start: 0, end: 0.32, layout: 'heart', label: '完整', camera: 'wide' },
    { id: 'separate', start: 0.32, end: 0.65, layout: 'broken-heart', label: '分离', camera: 'approach' },
    { id: 'space', start: 0.65, end: 0.88, layout: 'broken-heart', label: '留白', camera: 'hero' },
    { id: 'release', start: 0.88, end: 1, layout: 'broken-heart', label: '放下', camera: 'pullback' },
  ],
});
