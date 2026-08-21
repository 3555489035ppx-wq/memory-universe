import type { Memory } from '../../domain/memory';
import type { MemoryTemplateConfig, MemoryTemplateId, TemplateLayoutId, TemplateTransform } from '../types';
import { createBrokenHeartLayout } from '../layouts/broken-heart';
import { createGalaxyLayout } from '../layouts/galaxy';
import { createHeartLayout } from '../layouts/heart';
import { createHelixLayout } from '../layouts/helix';
import { createOrbitLayout } from '../layouts/orbit';
import { createScatteredLayout } from '../layouts/scattered';
import { createCascadeLayout } from '../layouts/cascade';
import { createDeckLayout } from '../layouts/deck';
import { createGravityLayout } from '../layouts/gravity';
import { createMosaicLayout } from '../layouts/mosaic';
import { createRibbonLayout } from '../layouts/ribbon';
import { createSpotlightLayout } from '../layouts/spotlight';
import { createTunnelLayout } from '../layouts/tunnel';
import { createWaveLayout } from '../layouts/wave';
import { createPrismLayout, createSphereLayout, createStarLayout, createTorusLayout } from '../layouts/geometric';

export type PreparedTemplateLayouts = Record<TemplateLayoutId, Record<string, TemplateTransform>>;

function emptyLayouts(): PreparedTemplateLayouts {
  return {
    scattered: {},
    orbit: {},
    heart: {},
    'broken-heart': {},
    galaxy: {},
    helix: {},
    mosaic: {},
    tunnel: {},
    ribbon: {},
    cascade: {},
    gravity: {},
    deck: {},
    wave: {},
    spotlight: {},
    sphere: {},
    star: {},
    torus: {},
    prism: {},
  };
}

export class LayoutEngine {
  prepare(
    config: Pick<MemoryTemplateConfig, 'id' | 'seed' | 'layout'>,
    memories: readonly Memory[],
    heroPhotoId: string | null,
  ): PreparedTemplateLayouts {
    const layouts = emptyLayouts();
    // A selected hero belongs to the short opening only. Normal chapters must
    // rotate the whole photo group instead of pinning one memory at the front.
    layouts.scattered = createScatteredLayout(memories, config.seed, null);
    layouts.orbit = createOrbitLayout(memories, config.seed + 101, null);
    layouts.heart = createHeartLayout(memories, config.seed + 211, null);
    layouts['broken-heart'] = createBrokenHeartLayout(memories, config.seed + 307, null);
    layouts.galaxy = createGalaxyLayout(memories, config.seed + 401, null);
    layouts.helix = createHelixLayout(memories, config.seed + 503, null);
    layouts.mosaic = createMosaicLayout(memories, config.seed + 601, null);
    layouts.tunnel = createTunnelLayout(memories, config.seed + 701, null);
    layouts.ribbon = createRibbonLayout(memories, config.seed + 809, null);
    layouts.cascade = createCascadeLayout(memories, config.seed + 907, null);
    layouts.gravity = createGravityLayout(memories, config.seed + 1_009, null);
    layouts.deck = createDeckLayout(memories, config.seed + 1_109, null);
    layouts.wave = createWaveLayout(memories, config.seed + 1_211, null);
    layouts.spotlight = createSpotlightLayout(memories, config.seed + 1_307, heroPhotoId);
    layouts.sphere = createSphereLayout(memories, config.seed + 1_409, null);
    layouts.star = createStarLayout(memories, config.seed + 1_517, null);
    layouts.torus = createTorusLayout(memories, config.seed + 1_621, null);
    layouts.prism = createPrismLayout(memories, config.seed + 1_733, null);
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
