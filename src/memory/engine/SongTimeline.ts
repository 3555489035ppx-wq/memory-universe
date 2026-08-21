import type {
  MemoryTemplateConfig,
  MotionCue,
  TemplateCameraId,
  TemplateLayoutId,
  TemplateMotionId,
  TimelinePhase,
} from '../types';

interface SceneRecipe {
  layout: TemplateLayoutId;
  camera: TemplateCameraId;
  motion: TemplateMotionId;
  duration: number;
  visibleCount: number;
  stagger: number;
  settleAt: number;
  easing: NonNullable<TimelinePhase['easing']>;
  label: string;
}

// The large hero appears once, briefly. It establishes the story without
// repeatedly pulling the same radio photo into the foreground.
const OPENING: SceneRecipe = {
  layout: 'spotlight',
  camera: 'hero',
  motion: 'hero-reveal',
  duration: 2.4,
  visibleCount: 16,
  stagger: 0.08,
  settleAt: 0.36,
  easing: 'expo-out',
  label: '第一眼',
};

const STORY_SCENES: readonly SceneRecipe[] = [
  { layout: 'deck', camera: 'wide', motion: 'deck-shuffle', duration: 6.5, visibleCount: 38, stagger: 0.2, settleAt: 0.58, easing: 'cinematic', label: '照片洗开' },
  { layout: 'gravity', camera: 'wide', motion: 'gravity-drop', duration: 7.2, visibleCount: 42, stagger: 0.3, settleAt: 0.72, easing: 'ease-out', label: '落在这一刻' },
  { layout: 'wave', camera: 'track-left', motion: 'wave-drift', duration: 6.8, visibleCount: 42, stagger: 0.16, settleAt: 0.54, easing: 'cinematic', label: '记忆起伏' },
  { layout: 'wave', camera: 'approach', motion: 'wave-surface', duration: 6.9, visibleCount: 42, stagger: 0.14, settleAt: 0.52, easing: 'cinematic', label: '潮汐波面' },
  { layout: 'tunnel', camera: 'dive', motion: 'depth-bloom', duration: 7.4, visibleCount: 38, stagger: 0.18, settleAt: 0.52, easing: 'cinematic', label: '从远处浮现' },
  { layout: 'mosaic', camera: 'approach', motion: 'assemble', duration: 6.8, visibleCount: 42, stagger: 0.18, settleAt: 0.56, easing: 'cinematic', label: '一页展开' },
  { layout: 'ribbon', camera: 'track-right', motion: 'film-rail', duration: 6.6, visibleCount: 40, stagger: 0.16, settleAt: 0.54, easing: 'cinematic', label: '沿胶片掠过' },
  { layout: 'helix', camera: 'pullback', motion: 'helix-bloom', duration: 7.2, visibleCount: 38, stagger: 0.16, settleAt: 0.52, easing: 'cinematic', label: '向上生长' },
  { layout: 'cascade', camera: 'top-down', motion: 'accordion-fold', duration: 6.9, visibleCount: 40, stagger: 0.22, settleAt: 0.58, easing: 'cinematic', label: '折页展开' },
  { layout: 'orbit', camera: 'approach', motion: 'carousel', duration: 7.4, visibleCount: 42, stagger: 0.13, settleAt: 0.5, easing: 'cinematic', label: '围绕此刻' },
  { layout: 'galaxy', camera: 'pullback', motion: 'galaxy-constellation', duration: 7.6, visibleCount: 44, stagger: 0.14, settleAt: 0.5, easing: 'cinematic', label: '星河涌现' },
  { layout: 'scattered', camera: 'track-right', motion: 'disperse', duration: 6.5, visibleCount: 38, stagger: 0.17, settleAt: 0.52, easing: 'cinematic', label: '散落片段' },
  { layout: 'galaxy', camera: 'approach', motion: 'gallery-lock', duration: 6.7, visibleCount: 42, stagger: 0.12, settleAt: 0.5, easing: 'expo-out', label: '定格成册' },
  { layout: 'wave', camera: 'track-right', motion: 'magnetic-swap', duration: 6.6, visibleCount: 42, stagger: 0.18, settleAt: 0.56, easing: 'cinematic', label: '磁场换位' },
  { layout: 'gravity', camera: 'top-down', motion: 'gravity-assemble', duration: 7.1, visibleCount: 44, stagger: 0.2, settleAt: 0.6, easing: 'cinematic', label: '落成相纸堆' },
  { layout: 'tunnel', camera: 'track-left', motion: 'fly-through', duration: 7.2, visibleCount: 38, stagger: 0.15, settleAt: 0.46, easing: 'cinematic', label: '穿过长廊' },
  { layout: 'mosaic', camera: 'wide', motion: 'mosaic-lock', duration: 6.8, visibleCount: 44, stagger: 0.1, settleAt: 0.46, easing: 'expo-out', label: '满页合影' },
  { layout: 'ribbon', camera: 'pullback', motion: 'ribbon-sweep', duration: 6.6, visibleCount: 40, stagger: 0.15, settleAt: 0.54, easing: 'cinematic', label: '缎带展开' },
  { layout: 'helix', camera: 'dive', motion: 'spiral-lift', duration: 7.1, visibleCount: 40, stagger: 0.19, settleAt: 0.56, easing: 'cinematic', label: '螺旋上升' },
  { layout: 'cascade', camera: 'track-left', motion: 'rain-drop', duration: 7, visibleCount: 42, stagger: 0.28, settleAt: 0.7, easing: 'ease-out', label: '雨一样落下' },
  { layout: 'orbit', camera: 'top-down', motion: 'topdown-ripple', duration: 7.2, visibleCount: 42, stagger: 0.16, settleAt: 0.52, easing: 'cinematic', label: '俯瞰相遇' },
  { layout: 'galaxy', camera: 'dive', motion: 'galaxy-orbit', duration: 7.4, visibleCount: 44, stagger: 0.13, settleAt: 0.48, easing: 'cinematic', label: '掠过群星' },
  { layout: 'scattered', camera: 'wide', motion: 'reassemble', duration: 6.6, visibleCount: 40, stagger: 0.2, settleAt: 0.58, easing: 'cinematic', label: '重新聚拢' },
  { layout: 'helix', camera: 'track-right', motion: 'photo-flip', duration: 6.5, visibleCount: 42, stagger: 0.2, settleAt: 0.58, easing: 'cinematic', label: '翻动相纸' },
  { layout: 'wave', camera: 'pullback', motion: 'afterglow-wave', duration: 6.8, visibleCount: 44, stagger: 0.17, settleAt: 0.54, easing: 'cinematic', label: '余波远去' },
  { layout: 'orbit', camera: 'track-left', motion: 'vortex-drift', duration: 6.6, visibleCount: 42, stagger: 0.12, settleAt: 0.5, easing: 'cinematic', label: '涡旋移动' },
  { layout: 'galaxy', camera: 'dive', motion: 'prism-turn', duration: 6.9, visibleCount: 44, stagger: 0.14, settleAt: 0.48, easing: 'cinematic', label: '棱镜翻转' },
  { layout: 'helix', camera: 'pullback', motion: 'starburst-lane', duration: 7.1, visibleCount: 42, stagger: 0.15, settleAt: 0.52, easing: 'cinematic', label: '星光突出' },
  { layout: 'ribbon', camera: 'track-right', motion: 'orbital-cross', duration: 6.7, visibleCount: 40, stagger: 0.13, settleAt: 0.5, easing: 'cinematic', label: '交收轨迹' },
  { layout: 'tunnel', camera: 'dive', motion: 'depth-surge', duration: 7.2, visibleCount: 40, stagger: 0.16, settleAt: 0.44, easing: 'cinematic', label: '深度冲刺' },
  { layout: 'gravity', camera: 'track-left', motion: 'gravity-sling', duration: 6.8, visibleCount: 42, stagger: 0.18, settleAt: 0.58, easing: 'ease-out', label: '弧线坠落' },
  { layout: 'galaxy', camera: 'top-down', motion: 'ring-collapse', duration: 6.5, visibleCount: 44, stagger: 0.12, settleAt: 0.46, easing: 'expo-out', label: '环形收拢' },
  { layout: 'helix', camera: 'track-right', motion: 'ribbon-corkscrew', duration: 7, visibleCount: 42, stagger: 0.14, settleAt: 0.52, easing: 'cinematic', label: '绸带旋转' },
  { layout: 'wave', camera: 'approach', motion: 'wave-fold', duration: 6.6, visibleCount: 44, stagger: 0.16, settleAt: 0.5, easing: 'cinematic', label: '波浪折叠' },
  { layout: 'tunnel', camera: 'pullback', motion: 'tunnel-shatter', duration: 7.3, visibleCount: 40, stagger: 0.15, settleAt: 0.42, easing: 'cinematic', label: '长廊分解' },
  { layout: 'galaxy', camera: 'wide', motion: 'constellation-breathe', duration: 6.9, visibleCount: 44, stagger: 0.11, settleAt: 0.48, easing: 'cinematic', label: '星座呼吸' },
  { layout: 'orbit', camera: 'approach', motion: 'magnetic-arc', duration: 6.7, visibleCount: 42, stagger: 0.13, settleAt: 0.52, easing: 'cinematic', label: '磁力弧光' },
  { layout: 'gravity', camera: 'top-down', motion: 'particle-lift', duration: 6.8, visibleCount: 44, stagger: 0.2, settleAt: 0.58, easing: 'ease-out', label: '粒粒上扬' },
  { layout: 'helix', camera: 'dive', motion: 'spiral-shear', duration: 7.1, visibleCount: 40, stagger: 0.16, settleAt: 0.5, easing: 'cinematic', label: '螺旋扫过' },
  { layout: 'ribbon', camera: 'track-left', motion: 'orbital-swap', duration: 6.5, visibleCount: 42, stagger: 0.15, settleAt: 0.54, easing: 'cinematic', label: '轨道换排' },
  { layout: 'orbit', camera: 'pullback', motion: 'cylinder-roll', duration: 7.2, visibleCount: 44, stagger: 0.12, settleAt: 0.5, easing: 'cinematic', label: '圆柱滚动' },
  { layout: 'scattered', camera: 'track-right', motion: 'diagonal-sweep', duration: 6.6, visibleCount: 40, stagger: 0.18, settleAt: 0.56, easing: 'cinematic', label: '斜向扫落' },
  { layout: 'galaxy', camera: 'dive', motion: 'blackhole-gather', duration: 6.9, visibleCount: 44, stagger: 0.14, settleAt: 0.46, easing: 'cinematic', label: '黑洞聚拢' },
  // Signature 3D chapters are denser than a typical focal shot so the whole
  // library participates throughout a long song, but remain below the 44-card
  // story maximum so their silhouettes stay readable.
  { layout: 'sphere', camera: 'approach', motion: 'sphere-pulse', duration: 6.6, visibleCount: 38, stagger: 0.12, settleAt: 0.5, easing: 'cinematic', label: '球面呼吸' },
  { layout: 'star', camera: 'pullback', motion: 'star-ignite', duration: 6.8, visibleCount: 38, stagger: 0.13, settleAt: 0.48, easing: 'cinematic', label: '五芒星爆' },
  { layout: 'torus', camera: 'dive', motion: 'torus-spin', duration: 6.7, visibleCount: 38, stagger: 0.12, settleAt: 0.5, easing: 'cinematic', label: '环形穿梭' },
  { layout: 'prism', camera: 'wide', motion: 'prism-fold', duration: 6.6, visibleCount: 38, stagger: 0.14, settleAt: 0.52, easing: 'cinematic', label: '六面晶体' },
] as const;

const ENDING: SceneRecipe = {
  layout: 'mosaic',
  camera: 'wide',
  motion: 'farewell-particle-gather',
  duration: 7.2,
  visibleCount: 44,
  stagger: 0.08,
  settleAt: 0.44,
  easing: 'expo-out',
  label: '再见了，我们的青春',
};

const MIN_SCENE_DURATION = 3.5;

// Geometric chapters are feature moments, not a final-act pile-up. Keeping
// their order intentional gives a long song recurring visual peaks while the
// surrounding chapters still change camera, rhythm and photo behaviour.
const FEATURED_3D_MOTIONS: readonly TemplateMotionId[] = [
  'sphere-pulse',
  'torus-spin',
  'star-ignite',
  'cylinder-roll',
  'prism-fold',
] as const;

/**
 * Different names can still read as the same movement to a viewer. These
 * families let the timeline alternate not just a function name, but the
 * visible silhouette, entry energy and camera relationship of each chapter.
 */
type MotionFamily =
  | 'drop-impact'
  | 'surface-wave'
  | 'forward-depth'
  | 'page-fold'
  | 'spiral-orbit'
  | 'constellation'
  | 'scatter-gather'
  | 'rail-ribbon'
  | 'geometric-volume'
  | 'rhythmic-swap';

export function motionFamily(scene: Pick<TimelinePhase, 'motion'>): MotionFamily {
  const motion = scene.motion ?? '';
  if (['gravity-drop', 'gravity-assemble', 'rain-drop', 'gravity-sling', 'particle-lift'].includes(motion)) return 'drop-impact';
  if (['wave-drift', 'wave-surface', 'afterglow-wave', 'wave-fold'].includes(motion)) return 'surface-wave';
  if (['depth-bloom', 'fly-through', 'depth-surge', 'tunnel-shatter'].includes(motion)) return 'forward-depth';
  if (['deck-shuffle', 'assemble', 'gallery-lock', 'mosaic-lock', 'accordion-fold', 'photo-flip'].includes(motion)) return 'page-fold';
  if (['carousel', 'topdown-ripple', 'galaxy-orbit', 'vortex-drift', 'ring-collapse', 'magnetic-arc', 'orbital-swap'].includes(motion)) return 'spiral-orbit';
  if (['galaxy-constellation', 'constellation-breathe', 'blackhole-gather'].includes(motion)) return 'constellation';
  if (['disperse', 'reassemble', 'diagonal-sweep'].includes(motion)) return 'scatter-gather';
  if (['film-rail', 'ribbon-sweep', 'ribbon-corkscrew', 'helix-bloom', 'spiral-lift', 'spiral-shear'].includes(motion)) return 'rail-ribbon';
  if (['sphere-pulse', 'star-ignite', 'torus-spin', 'prism-fold', 'cylinder-roll'].includes(motion)) return 'geometric-volume';
  return 'rhythmic-swap';
}

export function cameraFamily(scene: Pick<TimelinePhase, 'camera'>): 'forward' | 'lateral' | 'overview' {
  if (scene.camera === 'dive' || scene.camera === 'approach' || scene.camera === 'hero') return 'forward';
  if (scene.camera === 'track-left' || scene.camera === 'track-right') return 'lateral';
  return 'overview';
}

function clampSongDuration(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value <= 0) return Math.max(1, fallback);
  return Math.max(1, value);
}

function selectUniqueStoryScenes(count: number): SceneRecipe[] {
  if (count <= 0) return [];
  const targetCount = Math.min(count, STORY_SCENES.length);
  if (targetCount === 1) return [STORY_SCENES[Math.floor(STORY_SCENES.length / 2)] ?? STORY_SCENES[0]].filter(Boolean) as SceneRecipe[];

  const featured = FEATURED_3D_MOTIONS
    .map((motion) => STORY_SCENES.find((scene) => scene.motion === motion))
    .filter((scene): scene is SceneRecipe => Boolean(scene));
  const featuredCount = Math.min(
    featured.length,
    targetCount < 7 ? 0 : Math.max(1, Math.floor((targetCount + 3) / 9)),
  );
  const featuredSlots = Array.from({ length: featuredCount }, (_, index) => (
    Math.round(((index + 1) * (targetCount + 1)) / (featuredCount + 1)) - 1
  ));

  // Choose the next scene by visual distance, and reserve evenly distributed
  // positions for the signature 3D chapters. The old tie-break simply walked
  // the source array, which pushed sphere/star/torus/prism to the end.
  const remaining = STORY_SCENES.map((scene, index) => ({ scene, index }));
  const selected: SceneRecipe[] = [];
  while (selected.length < targetCount && remaining.length > 0) {
    const selectedIndex = selected.length;
    const featureSlotIndex = featuredSlots.indexOf(selectedIndex);
    const scheduledFeature = featureSlotIndex >= 0 ? featured[featureSlotIndex] : undefined;
    const candidates = scheduledFeature
      ? remaining.filter((candidate) => candidate.scene.motion === scheduledFeature.motion)
      : remaining.filter((candidate) => !FEATURED_3D_MOTIONS.includes(candidate.scene.motion));
    const pool = candidates.length > 0 ? candidates : remaining;
    // A score alone still permits a repeated visual family when the sorter
    // reaches a tie. Apply a true cooldown first: unless this is an explicitly
    // reserved feature beat, the previous three chapters are unavailable to
    // the same motion family. At roughly 6–7s per chapter this avoids an
    // approximately-20-second visual echo in a three-minute track.
    const recentFamilies = new Set(selected.slice(-3).map((scene) => motionFamily(scene)));
    const previousLayout = selected.at(-1)?.layout;
    const cooledPool = scheduledFeature
      ? pool
      : pool.filter((candidate) => (
        !recentFamilies.has(motionFamily(candidate.scene))
        && candidate.scene.layout !== previousLayout
      ));
    // If a full three-chapter cooldown is momentarily impossible, relax only
    // that longer preference. Never relax the immediate visual contract: the
    // next chapter may not share either the previous composition or motion
    // family.
    const nonAdjacentPool = pool.filter((candidate) => (
      motionFamily(candidate.scene) !== motionFamily(selected.at(-1) ?? candidate.scene)
      && candidate.scene.layout !== previousLayout
    ));
    const selectionPool = cooledPool.length > 0
      ? cooledPool
      : nonAdjacentPool.length > 0
        ? nonAdjacentPool
        : pool;
    const next = selectionPool
      .toSorted((left, right) => {
        const score = (candidate: SceneRecipe): number => {
          const previous = selected.at(-1);
          const twoBack = selected.at(-2);
          const threeBack = selected.at(-3);
          const fourBack = selected.at(-4);
          let value = 0;
          if (previous?.motion === candidate.motion) value += 1_000;
          if (twoBack?.motion === candidate.motion) value += 220;
          if (threeBack?.motion === candidate.motion) value += 90;
          if (previous && motionFamily(previous) === motionFamily(candidate)) value += 840;
          if (twoBack && motionFamily(twoBack) === motionFamily(candidate)) value += 180;
          if (threeBack && motionFamily(threeBack) === motionFamily(candidate)) value += 110;
          if (fourBack && motionFamily(fourBack) === motionFamily(candidate)) value += 60;
          if (previous?.layout === candidate.layout) value += 460;
          if (twoBack?.layout === candidate.layout) value += 125;
          if (threeBack?.layout === candidate.layout) value += 70;
          if (previous && cameraFamily(previous) === cameraFamily(candidate)) value += 640;
          if (twoBack && cameraFamily(twoBack) === cameraFamily(candidate)) value += 95;
          return value;
        };
        return score(left.scene) - score(right.scene) || left.index - right.index;
      })[0];
    if (!next) break;
    selected.push(next.scene);
    remaining.splice(remaining.indexOf(next), 1);
  }
  // The greedy pass establishes the distributed feature beats. A final local
  // repair handles the rare end-of-list case where all remaining candidates
  // share one layout: swap with a later compatible chapter, verifying both
  // neighbours around each swapped position.
  const repaired = [...selected];
  const conflictsAt = (index: number): boolean => {
    if (index <= 0 || index >= repaired.length) return false;
    const previous = repaired[index - 1];
    const current = repaired[index];
    if (!previous || !current) return false;
    return previous.layout === current.layout || motionFamily(previous) === motionFamily(current);
  };
  const affectedIndexes = (left: number, right: number): number[] => (
    [...new Set([left - 1, left, left + 1, right - 1, right, right + 1])]
      .filter((index) => index >= 1 && index < repaired.length)
  );
  for (let pass = 0; pass < repaired.length; pass += 1) {
    let changed = false;
    for (let index = 1; index < repaired.length; index += 1) {
      if (!conflictsAt(index)) continue;
      for (let swapIndex = 0; swapIndex < repaired.length; swapIndex += 1) {
        if (swapIndex === index || Math.abs(swapIndex - index) <= 1) continue;
        const left = repaired[index];
        const right = repaired[swapIndex];
        if (!left || !right) continue;
        repaired[index] = right;
        repaired[swapIndex] = left;
        const valid = affectedIndexes(index, swapIndex).every((candidateIndex) => !conflictsAt(candidateIndex));
        if (valid) {
          changed = true;
          break;
        }
        repaired[index] = left;
        repaired[swapIndex] = right;
      }
    }
    if (!changed) break;
  }
  return repaired;
}

function cueKindForPhase(phase: TimelinePhase, final: boolean): MotionCue['kind'] {
  if (final) return 'farewell';
  if (phase.motion === 'hero-reveal') return 'reveal';
  if (phase.motion === 'magnetic-swap') return 'cluster';
  if (phase.motion === 'gravity-drop' || phase.motion === 'deck-shuffle') return 'accent';
  if (phase.camera === 'hero') return 'focus';
  return 'chapter';
}

function buildMotionCues(phases: readonly TimelinePhase[], durationSeconds: number): MotionCue[] {
  const finalIndex = phases.length - 1;
  const peakIndices = new Set(
    [0, 0.2, 0.4, 0.62, 0.82, 1]
      .map((ratio) => Math.round(finalIndex * ratio)),
  );
  return phases.map((phase, index) => ({
    time: phase.start * durationSeconds,
    kind: cueKindForPhase(phase, index === finalIndex),
    strength: peakIndices.has(index) ? 2 : index % 3 === 0 ? 0 : 1,
    label: phase.label,
  }));
}

/** Expands the authored visual language to the complete remaining song. */
export function buildSongTimelineConfig(
  base: MemoryTemplateConfig,
  requestedDurationSeconds: number,
): MemoryTemplateConfig {
  const durationSeconds = clampSongDuration(requestedDurationSeconds, base.durationSeconds);
  const openingDuration = Math.min(OPENING.duration, durationSeconds * 0.2);
  const endingDuration = Math.min(ENDING.duration, Math.max(0, durationSeconds - openingDuration));
  const storyDuration = Math.max(0, durationSeconds - openingDuration - endingDuration);
  const storyCount = Math.min(
    STORY_SCENES.length,
    storyDuration >= MIN_SCENE_DURATION ? Math.max(1, Math.floor(storyDuration / MIN_SCENE_DURATION)) : 0,
  );
  const selectedScenes = selectUniqueStoryScenes(storyCount);
  const authoredStoryDuration = selectedScenes.reduce((total, recipe) => total + recipe.duration, 0);
  const storyScale = authoredStoryDuration > 0 ? storyDuration / authoredStoryDuration : 0;
  const recipes: SceneRecipe[] = [
    { ...OPENING, duration: openingDuration },
    ...selectedScenes.map((recipe) => ({ ...recipe, duration: recipe.duration * storyScale })),
    { ...ENDING, duration: endingDuration },
  ];

  let cursor = 0;
  let photoOffset = 0;
  const phases = recipes.map((recipe, index): TimelinePhase => {
    const startSeconds = cursor;
    const endSeconds = index === recipes.length - 1
      ? durationSeconds
      : Math.min(durationSeconds, cursor + recipe.duration);
    cursor = endSeconds;
    const phase: TimelinePhase = {
      id: index === 0 ? 'song-hook' : index === recipes.length - 1 ? 'song-ending' : `song-scene-${String(index).padStart(2, '0')}`,
      start: startSeconds / durationSeconds,
      end: endSeconds / durationSeconds,
      layout: recipe.layout,
      label: recipe.label,
      camera: recipe.camera,
      motion: recipe.motion,
      easing: recipe.easing,
      visibleCount: recipe.visibleCount,
      photoOffset,
      stagger: recipe.stagger,
      settleAt: recipe.settleAt,
      ...(recipe.layout === 'spotlight' ? { heroPhotoRole: 'middle' as const } : {}),
    };
    photoOffset += Math.max(9, recipe.visibleCount - 7) + index;
    return phase;
  });

  return { ...base, durationSeconds, phases, motionCues: buildMotionCues(phases, durationSeconds) };
}

export interface SongProgressInput {
  currentTime: number;
  mediaDuration: number;
  cueStart: number;
}

export function songTimelineProgress(input: SongProgressInput): number {
  const cueStart = Math.max(0, Number.isFinite(input.cueStart) ? input.cueStart : 0);
  const mediaDuration = Number.isFinite(input.mediaDuration) ? input.mediaDuration : 0;
  const available = Math.max(0.001, mediaDuration - cueStart);
  const elapsed = Math.max(0, (Number.isFinite(input.currentTime) ? input.currentTime : 0) - cueStart);
  return Math.min(1, elapsed / available);
}
