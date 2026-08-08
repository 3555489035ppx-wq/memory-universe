import type { MemoryTemplateConfig } from '../types';
import { assertValidTemplateConfig } from './validateTemplateConfig';

export const highSchoolTemplate = assertValidTemplateConfig<MemoryTemplateConfig>({
  id: 'high-school',
  title: '那年夏天',
  category: '高中记忆',
  description: '从苏醒、校园与朋友，到一段仍然向前的夏天。',
  durationSeconds: 48,
  available: true,
  layout: 'orbit',
  seed: 2_026_080_5,
  minPhotos: 1,
  maxPhotos: 60,
  phases: [
    { id: 'awakening', start: 0, end: 0.1, layout: 'scattered', label: '苏醒', camera: 'wide', easing: 'ease-out' },
    { id: 'corridor', start: 0.1, end: 0.28, layout: 'orbit', label: '校园', camera: 'approach', easing: 'ease-in-out' },
    { id: 'people', start: 0.28, end: 0.48, layout: 'orbit', label: '人物', camera: 'approach', easing: 'ease-in-out' },
    { id: 'gather', start: 0.48, end: 0.7, layout: 'orbit', label: '聚合', camera: 'hero', easing: 'ease-in-out' },
    {
      id: 'hero',
      start: 0.7,
      end: 0.88,
      layout: 'orbit',
      label: '那年夏天',
      camera: 'hero',
      easing: 'ease-out',
      heroPhotoRole: 'middle',
    },
    { id: 'outro', start: 0.88, end: 1, layout: 'orbit', label: '继续向前', camera: 'pullback', easing: 'ease-in-out' },
  ],
});
