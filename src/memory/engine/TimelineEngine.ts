import type { Memory } from '../../domain/memory';
import type { MemoryTemplateConfig, PhotoLifecycleState, TemplatePhotoState, TemplateTransform, TimelinePhase, TimelineState } from '../types';
import { applyEasing } from './easing';
import { interpolateTransform } from './interpolateTransform';
import { choreographPhotoTransform } from './PhotoChoreography';
import type { PreparedTemplateLayouts } from './LayoutEngine';
import { clamp01 } from './seededRandom';
import { cameraPoseForProgress } from './CameraDirector';
import { applyPhotoExitTransform, crossfadeDurationSeconds, lifecycleOpacity } from './PhotoLifecycle';
import { evaluateFarewellSequence } from './FarewellSequence';
import { compositionBounds, geometricSurfaceKind, type PhaseLayoutMap } from './composePhaseLayouts';
import { resolvePhotoFrameCollisions } from './photoFrameSafety';

export interface TimelineContext {
  config: MemoryTemplateConfig;
  memories: readonly Memory[];
  heroPhotoId: string | null;
  layouts: PreparedTemplateLayouts;
  phaseLayouts?: PhaseLayoutMap;
  reducedMotion?: boolean;
  viewportAspect?: number;
}

export interface TimelineFrameContext {
  clamped: number;
  phase: TimelinePhase;
  phaseIndex: number;
  rawLocal: number;
  photoProgress: number;
  previousPhase: TimelinePhase | undefined;
  farewellPhotoOpacity: number;
}

/**
 * Dense chapters keep a compact camera-facing mass; their z-depth still
 * carries the 3D silhouette. Mosaic and geometric surface chapters are already
 * packed against the frame, so the runtime safety pass only makes a gentle
 * correction instead of squeezing them into an overlap and pushing cards out.
 */
export function photoFrameClusterFactor(phase: TimelinePhase): number {
  if (phase.layout === 'mosaic') return 1;
  if (geometricSurfaceKind(phase)) return 0.94;
  if (phase.layout === 'wave') return 0.98;
  if (
    phase.layout === 'orbit'
    || phase.layout === 'scattered'
    || phase.layout === 'galaxy'
    || phase.layout === 'helix'
    || phase.layout === 'ribbon'
    || phase.layout === 'tunnel'
    || phase.layout === 'gravity'
    || phase.layout === 'deck'
    || phase.layout === 'cascade'
  ) return 0.985;
  return 0.76;
}

function phaseAt(config: MemoryTemplateConfig, progress: number): { phase: TimelinePhase; index: number } {
  const value = clamp01(progress);
  const index = config.phases.findIndex((phase, phaseIndex) => {
    const finalPhase = phaseIndex === config.phases.length - 1;
    return value >= phase.start && (value < phase.end || finalPhase);
  });
  const safeIndex = index < 0 ? config.phases.length - 1 : index;
  const phase = config.phases[safeIndex];
  if (!phase) throw new Error(`Template ${config.id} has no phase for progress ${String(value)}`);
  return { phase, index: safeIndex };
}

function localProgress(phase: TimelinePhase, progress: number): number {
  return clamp01((clamp01(progress) - phase.start) / Math.max(0.0001, phase.end - phase.start));
}

export function createTimelineFrame(progress: number, context: TimelineContext): TimelineFrameContext {
  const clamped = clamp01(progress);
  const { phase, index: phaseIndex } = phaseAt(context.config, clamped);
  const rawLocal = localProgress(phase, clamped);
  return {
    clamped,
    phase,
    phaseIndex,
    rawLocal,
    photoProgress: clamp01(rawLocal / Math.max(0.1, Math.min(1, phase.settleAt ?? 1))),
    previousPhase: context.config.phases[phaseIndex - 1],
    farewellPhotoOpacity: evaluateFarewellSequence(
      clamped * context.config.durationSeconds,
      context.config.durationSeconds,
      context.reducedMotion,
    ).photoOpacity,
  };
}

function staggeredProgress(progress: number, index: number, total: number, amount: number): number {
  const stagger = clamp01(amount);
  if (stagger <= 0 || total <= 1) return clamp01(progress);
  const delay = (index / (total - 1)) * stagger;
  return clamp01((progress - delay) / Math.max(0.001, 1 - stagger));
}

function phaseWindowOrder(index: number, total: number, phase: TimelinePhase): { order: number; count: number } {
  const count = Math.max(1, Math.min(total, phase.visibleCount ?? total));
  const offset = ((phase.photoOffset ?? 0) % Math.max(1, total) + total) % Math.max(1, total);
  return {
    order: (index - offset + total) % Math.max(1, total),
    count,
  };
}

export function isPhotoInPhaseWindow(index: number, total: number, phase: TimelinePhase): boolean {
  const count = Math.max(0, Math.min(total, phase.visibleCount ?? total));
  if (count >= total) return true;
  const offset = ((phase.photoOffset ?? 0) % Math.max(1, total) + total) % Math.max(1, total);
  const relative = (index - offset + total) % total;
  return relative < count;
}

function lifecycleForPhoto(
  phase: TimelinePhase,
  previousPhase: TimelinePhase | undefined,
  phaseProgress: number,
  memoryIndex: number,
  total: number,
  durationSeconds: number,
  seed: number,
  memoryId: string,
  forceCurrentVisible = false,
  forcePreviousVisible = false,
): PhotoLifecycleState {
  const currentVisible = forceCurrentVisible || isPhotoInPhaseWindow(memoryIndex, total, phase);
  if (!previousPhase) {
    return currentVisible
      ? { stage: 'stable', progress: 1, removable: false }
      : { stage: 'released', progress: 1, removable: true };
  }
  const previousVisible = forcePreviousVisible || isPhotoInPhaseWindow(memoryIndex, total, previousPhase);
  if (currentVisible && previousVisible) return { stage: 'stable', progress: 1, removable: false };
  if (!currentVisible && !previousVisible) return { stage: 'released', progress: 1, removable: true };

  const phaseSeconds = Math.max(0.1, (phase.end - phase.start) * durationSeconds);
  const elapsedSeconds = phaseProgress * phaseSeconds;
  // Keep two chapters on screen long enough to read the relationship between
  // them. The overlap is bounded so adding more chapters still shortens each
  // scene instead of making the song feel slow.
  const crossfadeSeconds = crossfadeDurationSeconds(phaseSeconds);
  if (currentVisible) {
    const order = phaseWindowOrder(memoryIndex, total, phase);
    const orderRatio = order.count <= 1 ? 0 : order.order / (order.count - 1);
    const staggerWindow = Math.min(0.9, phaseSeconds * Math.min(0.28, phase.stagger ?? 0) * 0.65);
    const delaySeconds = orderRatio * staggerWindow;
    const enterProgress = clamp01((elapsedSeconds - delaySeconds) / Math.min(0.94, crossfadeSeconds * 0.86));
    return enterProgress < 1
      ? { stage: 'entering', progress: enterProgress, removable: false }
      : { stage: 'stable', progress: 1, removable: false };
  }

  const previousOrder = phaseWindowOrder(memoryIndex, total, previousPhase);
  const orderRatio = previousOrder.count <= 1 ? 0 : previousOrder.order / (previousOrder.count - 1);
  const deterministicDelay = 0.03 + Math.abs(Math.sin((memoryIndex + 1) * 17.17 + seed + memoryId.length)) * 0.04;
  const heroDelay = forcePreviousVisible ? 0.12 : 0;
  const delaySeconds = deterministicDelay + orderRatio * 0.18 + heroDelay;
  const exitProgress = clamp01((elapsedSeconds - delaySeconds) / crossfadeSeconds);
  if (exitProgress < 1) return { stage: 'exiting', progress: exitProgress, removable: false };
  const releaseAfterSeconds = delaySeconds + crossfadeSeconds + 0.28;
  return elapsedSeconds < releaseAfterSeconds
    ? { stage: 'retained', progress: 1, removable: false }
    : { stage: 'released', progress: 1, removable: true };
}

function transformsForMemory(
  context: TimelineContext,
  phase: TimelinePhase,
  index: number,
  memoryId: string,
  memoryIndex: number,
  layoutBlendProgress = 1,
  forceCurrentVisible = false,
  forcePreviousVisible = false,
): { current: TemplateTransform; previous: TemplateTransform } | null {
  const layoutFor = (candidate: TimelinePhase): Readonly<Record<string, TemplateTransform>> =>
    context.phaseLayouts?.[candidate.id] ?? context.layouts[candidate.layout];
  const current = layoutFor(phase)[memoryId];
  if (!current) return null;
  if (index === 0) return { current, previous: current };
  const previousPhase = context.config.phases[index - 1];
  const previousLayout = previousPhase ? layoutFor(previousPhase) : layoutFor(phase);
  const previous = previousLayout[memoryId] ?? current;
  const visibleNow = forceCurrentVisible || isPhotoInPhaseWindow(memoryIndex, context.memories.length, phase);
  const wasVisible = previousPhase
    ? forcePreviousVisible || isPhotoInPhaseWindow(memoryIndex, context.memories.length, previousPhase)
    : visibleNow;

  // A photo that is entering this chapter has no meaningful position in the
  // previous chapter's visible composition. Its fallback transform used to be
  // the uncomposed source layout, which produced the visibly scattered
  // single-card flash at a scene boundary. New cards now dissolve in where
  // they belong; outgoing cards stay inside the old mass while they dissolve.
  if (!wasVisible) return { current, previous: current };
  if (!visibleNow) return { current: previous, previous };
  return { current: interpolateTransform(previous, current, clamp01(layoutBlendProgress)), previous };
}

function layoutBlendProgress(
  phase: TimelinePhase,
  rawLocal: number,
  durationSeconds: number,
): number {
  const phaseSeconds = Math.max(0.1, (phase.end - phase.start) * durationSeconds);
  const transition = crossfadeDurationSeconds(phaseSeconds);
  return applyEasing(clamp01((rawLocal * phaseSeconds) / transition), 'cinematic');
}

function emphasize(
  memoryId: string,
  heroPhotoId: string | null,
  phase: TimelinePhase,
  phaseProgress: number,
  index: number,
  total: number,
): TemplatePhotoState['emphasis'] {
  if (
    heroPhotoId === memoryId
    && phaseProgress > 0.04
    && (phase.camera === 'hero' || phase.id === 'hero' || phase.layout === 'spotlight')
  ) return 'hero';
  if (index < Math.max(2, Math.ceil(total * 0.22)) && phaseProgress > 0.35) return 'related';
  return 'quiet';
}

function photoSurfaceForPhase(phase: TimelinePhase): 'plane' | 'geometric' {
  if (geometricSurfaceKind(phase) || phase.motion === 'cylinder-roll') return 'geometric';
  return 'plane';
}

export function evaluateState(progress: number, context: TimelineContext): TimelineState {
  const frame = createTimelineFrame(progress, context);
  const photos = context.memories.flatMap((memory, memoryIndex): TemplatePhotoState[] => {
    const photo = evaluatePhotoStateAtFrame(frame, context, memory, memoryIndex);
    return photo ? [photo] : [];
  });
  return {
    progress: frame.clamped,
    phase: frame.phase,
    photos: resolvePhotoFrameCollisions(photos, {
      ...compositionBounds(context.viewportAspect),
      clusterFactor: photoFrameClusterFactor(frame.phase),
      activeMemoryIds: context.memories
        .filter((_, index) => isPhotoInPhaseWindow(index, context.memories.length, frame.phase))
        .map((memory) => memory.id),
    }),
    camera: cameraPoseForProgress(context.config, frame.clamped, context.heroPhotoId),
  };
}

/**
 * Per-photo evaluation used by the render loop. It avoids rebuilding the full
 * timeline array for every display frame while retaining the exact timeline
 * semantics used by the preview and tests.
 */
export function evaluatePhotoState(
  progress: number,
  context: TimelineContext,
  memory: Memory,
  memoryIndex: number,
): TemplatePhotoState | null {
  return evaluatePhotoStateAtFrame(createTimelineFrame(progress, context), context, memory, memoryIndex);
}

export function evaluatePhotoStateAtFrame(
  frame: TimelineFrameContext,
  context: TimelineContext,
  memory: Memory,
  memoryIndex: number,
): TemplatePhotoState | null {
  const { phase, phaseIndex: index, rawLocal, photoProgress } = frame;
  const window = phaseWindowOrder(memoryIndex, context.memories.length, phase);
  const local = applyEasing(
    staggeredProgress(photoProgress, window.order, window.count, phase.stagger ?? 0),
    phase.easing,
  );
  const previousPhase = frame.previousPhase;
  const isHeroPhoto = memory.id === context.heroPhotoId;
  const lifecycle = lifecycleForPhoto(
    phase,
    previousPhase,
    rawLocal,
    memoryIndex,
    context.memories.length,
    context.config.durationSeconds,
    context.config.seed,
    memory.id,
    isHeroPhoto && phase.layout === 'spotlight',
    isHeroPhoto && previousPhase?.layout === 'spotlight',
  );
  // Keep the authored entrance path for the complete chapter whenever a
  // photo is new to that chapter. Switching `incoming` off at the exact frame
  // where lifecycle changes from entering to stable made motions such as
  // gravity-sling reverse direction for one frame, which looked like a
  // vertical shake. Chapter membership is stable, so this flag is stable too.
  const currentVisibleForMotion = (isHeroPhoto && phase.layout === 'spotlight')
    || isPhotoInPhaseWindow(memoryIndex, context.memories.length, phase);
  const previousVisibleForMotion = previousPhase
    ? (isHeroPhoto && previousPhase.layout === 'spotlight')
      || isPhotoInPhaseWindow(memoryIndex, context.memories.length, previousPhase)
    : currentVisibleForMotion;
  const photoIsEnteringChapter = currentVisibleForMotion && !previousVisibleForMotion;
  const transforms = transformsForMemory(
    context,
    phase,
    index,
    memory.id,
    memoryIndex,
    lifecycle.stage === 'stable' || lifecycle.stage === 'entering'
      ? layoutBlendProgress(phase, rawLocal, context.config.durationSeconds)
      : 1,
    isHeroPhoto && phase.layout === 'spotlight',
    isHeroPhoto && previousPhase?.layout === 'spotlight',
  );
  if (!transforms) return null;
  // An outgoing photo should not freeze in the old chapter until it vanishes.
  // It eases a short distance toward the incoming composition while its
  // opacity dissolves, which makes a chapter change read as one continuous
  // hand-off instead of two separate clusters crossing the frame.
  const exitBlend = lifecycle.stage === 'exiting'
    ? applyEasing(clamp01(lifecycle.progress * 0.72), 'cinematic')
    : 0;
  const target = lifecycle.stage === 'exiting' || lifecycle.stage === 'retained'
    ? interpolateTransform(transforms.previous, transforms.current, exitBlend)
    : transforms.current;
  const opacity = target.opacity * lifecycleOpacity(lifecycle.stage, lifecycle.progress);
  const emphasis = emphasize(memory.id, context.heroPhotoId, phase, local, memoryIndex, context.memories.length);
  const choreographed = context.reducedMotion
    ? { ...target, opacity }
    : lifecycle.stage === 'exiting' || lifecycle.stage === 'retained'
      ? applyPhotoExitTransform({ ...target, opacity: target.opacity }, lifecycle.progress, memory.id, context.config.seed)
      : choreographPhotoTransform({
        ...target,
        opacity,
      }, {
        memoryId: memory.id,
        memoryIndex,
        phase,
        phaseProgress: local,
        seed: context.config.seed,
        emphasis,
        incoming: photoIsEnteringChapter,
        });
  const finalOpacity = opacity * frame.farewellPhotoOpacity;
  return {
    memory,
    transform: lifecycle.stage === 'retained' || lifecycle.stage === 'released'
      ? { ...choreographed, opacity: 0 }
      : { ...choreographed, opacity: finalOpacity },
    emphasis,
    lifecycle,
    surface: photoSurfaceForPhase(phase),
  };
}

export const evaluateTemplateState = evaluateState;
