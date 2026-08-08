import type { Memory } from '../../domain/memory';
import type { MemoryTemplateConfig, MemoryTemplateId, TemplateLayoutId, TemplateTransform } from '../types';
import { createBrokenHeartLayout } from '../layouts/broken-heart';
import { createGalaxyLayout } from '../layouts/galaxy';
import { createHeartLayout } from '../layouts/heart';
import { createHelixLayout } from '../layouts/helix';
import { createOrbitLayout } from '../layouts/orbit';
import { createScatteredLayout } from '../layouts/scattered';

export type PreparedTemplateLayouts = Record<TemplateLayoutId, Record<string, TemplateTransform>>;

function emptyLayouts(): PreparedTemplateLayouts {
  return {
    scattered: {},
    orbit: {},
    heart: {},
    'broken-heart': {},
    galaxy: {},
    helix: {},
  };
}

export class LayoutEngine {
  prepare(
    config: Pick<MemoryTemplateConfig, 'id' | 'seed' | 'layout'>,
    memories: readonly Memory[],
    heroPhotoId: string | null,
  ): PreparedTemplateLayouts {
    const layouts = emptyLayouts();
    layouts.scattered = createScatteredLayout(memories, config.seed, heroPhotoId);
    layouts.orbit = createOrbitLayout(memories, config.seed + 101, heroPhotoId);
    layouts.heart = createHeartLayout(memories, config.seed + 211, heroPhotoId);
    layouts['broken-heart'] = createBrokenHeartLayout(memories, config.seed + 307, heroPhotoId);
    layouts.galaxy = createGalaxyLayout(memories, config.seed + 401, heroPhotoId);
    layouts.helix = createHelixLayout(memories, config.seed + 503, heroPhotoId);
    return layouts;
  }

  layoutFor(
    templateId: MemoryTemplateId,
    layout: TemplateLayoutId,
    memories: readonly Memory[],
    seed: number,
    heroPhotoId: string | null,
  ): Record<string, TemplateTransform> {
    const config = { id: templateId, layout, seed } satisfies Pick<MemoryTemplateConfig, 'id' | 'layout' | 'seed'>;
    return this.prepare(config, memories, heroPhotoId)[layout];
  }
}

export const layoutEngine = new LayoutEngine();
