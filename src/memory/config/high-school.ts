import type { MemoryTemplateConfig } from '../types';
import { assertValidTemplateConfig } from './validateTemplateConfig';

export const highSchoolTemplate = assertValidTemplateConfig<MemoryTemplateConfig>({
  id: 'high-school',
  title: '那年夏天',
  category: '高中记忆',
  description: '从苏醒、校园与朋友，到一段仍然向前的夏天。',
  durationSeconds: 180,
  available: true,
  layout: 'orbit',
  seed: 2_026_080_5,
  minPhotos: 24,
  maxPhotos: 96,
  phases: [
    { id: 'hook', start: 0, end: 0.067, layout: 'spotlight', label: '那年夏天', camera: 'hero', motion: 'hero-reveal', easing: 'expo-out', visibleCount: 8, photoOffset: 0, stagger: 0.12, settleAt: 0.42, heroPhotoRole: 'middle' },
    { id: 'establish', start: 0.067, end: 0.167, layout: 'mosaic', label: '记忆展开', camera: 'wide', motion: 'assemble', easing: 'cinematic', visibleCount: 14, photoOffset: 0, stagger: 0.2, settleAt: 0.58 },
    { id: 'memory-a', start: 0.167, end: 0.3, layout: 'tunnel', label: '穿过校园', camera: 'dive', motion: 'fly-through', easing: 'cinematic', visibleCount: 12, photoOffset: 12, stagger: 0.15, settleAt: 0.38 },
    { id: 'relationship', start: 0.3, end: 0.417, layout: 'ribbon', label: '同行的人', camera: 'track-left', motion: 'ribbon-sweep', easing: 'cinematic', visibleCount: 14, photoOffset: 24, stagger: 0.16, settleAt: 0.55 },
    { id: 'midpoint', start: 0.417, end: 0.5, layout: 'mosaic', label: '十五秒定格', camera: 'approach', motion: 'gallery-lock', easing: 'expo-out', visibleCount: 16, photoOffset: 34, stagger: 0.12, settleAt: 0.5 },
    { id: 'chapter-b', start: 0.5, end: 0.617, layout: 'tunnel', label: '进入下一页', camera: 'dive', motion: 'fly-through', easing: 'cinematic', visibleCount: 12, photoOffset: 46, stagger: 0.14, settleAt: 0.38 },
    { id: 'acceleration', start: 0.617, end: 0.733, layout: 'cascade', label: '那些瞬间', camera: 'top-down', motion: 'cascade', easing: 'cinematic', visibleCount: 16, photoOffset: 56, stagger: 0.2, settleAt: 0.55 },
    { id: 'hero', start: 0.733, end: 0.85, layout: 'spotlight', label: '最想留下的一张', camera: 'hero', motion: 'hero-reveal', easing: 'expo-out', visibleCount: 10, photoOffset: 68, stagger: 0.1, settleAt: 0.45, heroPhotoRole: 'middle' },
    { id: 'closing', start: 0.85, end: 0.933, layout: 'orbit', label: '回望', camera: 'pullback', motion: 'carousel', easing: 'cinematic', visibleCount: 18, photoOffset: 4, stagger: 0.12, settleAt: 0.5 },
    { id: 'end-frame', start: 0.933, end: 1, layout: 'mosaic', label: '继续向前', camera: 'wide', motion: 'gallery-lock', easing: 'cinematic', visibleCount: 20, photoOffset: 60, stagger: 0.08, settleAt: 0.48 },
  ],
});
