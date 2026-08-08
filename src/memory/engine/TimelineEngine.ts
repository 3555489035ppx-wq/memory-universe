import type { Memory } from '../../domain/memory';
import type { MemoryTemplateConfig, TemplatePhotoState, TemplateTransform, TimelinePhase, TimelineState } from '../types';
import { applyEasing } from './easing';
import { interpolateTransform } from './interpolateTransform';
import type { PreparedTemplateLayouts } from './LayoutEngine';
import { clamp01 } from './seededRandom';
import { cameraPoseForProgress } from './CameraDirector';

export interface TimelineContext {
  config: MemoryTemplateConfig;
  memories: readonly Memory[];
  heroPhotoId: string | null;
  layouts: PreparedTemplateLayouts;
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

function phaseLayout(
  context: TimelineContext,
  phase: TimelinePhase,
  index: number,
  progress: number,
): Record<string, TemplateTransform> {
  const current = context.layouts[phase.layout];
  if (index === 0) return current;
  const previous = context.layouts[context.config.phases[index - 1]?.layout ?? phase.layout];
  const result: Record<string, TemplateTransform> = {};
  context.memories.forEach((memory) => {
    const from = previous[memory.id] ?? current[memory.id];
    const to = current[memory.id] ?? from;
    if (!from || !to) return;
    result[memory.id] = interpolateTransform(from, to, progress);
  });
  return result;
}

function emphasize(
  memoryId: string,
  heroPhotoId: string | null,
  phase: TimelinePhase,
  phaseProgress: number,
  index: number,
  total: number,
): TemplatePhotoState['emphasis'] {
  if (heroPhotoId === memoryId && phaseProgress > 0.16 && (phase.camera === 'hero' || phase.id === 'hero')) return 'hero';
  if (index < Math.max(2, Math.ceil(total * 0.22)) && phaseProgress > 0.35) return 'related';
  return 'quiet';
}

export function evaluateState(progress: number, context: TimelineContext): TimelineState {
  const clamped = clamp01(progress);
  const { phase, index } = phaseAt(context.config, clamped);
  const local = applyEasing(localProgress(phase, clamped), phase.easing);
  const targetLayout = phaseLayout(context, phase, index, local);
  const visibleCount = Math.max(0, Math.min(context.memories.length, phase.visibleCount ?? context.memories.length));
  const photos = context.memories.flatMap((memory, memoryIndex): TemplatePhotoState[] => {
    const target = targetLayout[memory.id];
    if (!target) return [];
    const opacity = phase.id === 'awakening' ? target.opacity * local : target.opacity;
    const heroHidden = context.heroPhotoId === memory.id && clamped < 0.56;
    return [{
      memory,
      transform: { ...target, opacity: memoryIndex < visibleCount && !heroHidden ? opacity : 0 },
      emphasis: emphasize(memory.id, context.heroPhotoId, phase, local, memoryIndex, context.memories.length),
    }];
  });
  return {
    progress: clamped,
    phase,
    photos,
    camera: cameraPoseForProgress(context.config, clamped, context.heroPhotoId),
  };
}

export const evaluateTemplateState = evaluateState;
