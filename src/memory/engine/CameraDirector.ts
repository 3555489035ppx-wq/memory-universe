import type { MemoryTemplateConfig } from '../types';
import type { Vec3 } from '../../engine/layout/layoutTypes';
import { clamp01 } from './seededRandom';

export interface CameraPose {
  position: Vec3;
  target: Vec3;
  fov: number;
}

const WIDE: CameraPose = { position: [0, 0.4, 15], target: [0, 0, -1.5], fov: 48 };
const APPROACH: CameraPose = { position: [0.4, 0.25, 11.5], target: [0, 0, 0], fov: 45 };
const HERO: CameraPose = { position: [0, 0.15, 8.4], target: [0, -0.08, 0.5], fov: 42 };
const PULLBACK: CameraPose = { position: [0, 0.5, 17], target: [0, 0, -1.6], fov: 50 };

function lerpPose(from: CameraPose, to: CameraPose, progress: number): CameraPose {
  const t = clamp01(progress);
  return {
    position: [
      from.position[0] + (to.position[0] - from.position[0]) * t,
      from.position[1] + (to.position[1] - from.position[1]) * t,
      from.position[2] + (to.position[2] - from.position[2]) * t,
    ],
    target: [
      from.target[0] + (to.target[0] - from.target[0]) * t,
      from.target[1] + (to.target[1] - from.target[1]) * t,
      from.target[2] + (to.target[2] - from.target[2]) * t,
    ],
    fov: from.fov + (to.fov - from.fov) * t,
  };
}

export function cameraPoseForProgress(
  config: Pick<MemoryTemplateConfig, 'phases'>,
  progress: number,
  heroPhotoId: string | null,
): CameraPose {
  void heroPhotoId;
  const value = clamp01(progress);
  const phase = config.phases.find((candidate, index) => value < candidate.end || index === config.phases.length - 1) ?? config.phases[0];
  if (!phase) return WIDE;
  const current = phase.camera === 'wide' ? WIDE : phase.camera === 'approach' ? APPROACH : phase.camera === 'hero' ? HERO : PULLBACK;
  const index = config.phases.indexOf(phase);
  const previous = config.phases[index - 1];
  if (!previous) return lerpPose(WIDE, current, Math.min(1, (value - phase.start) / Math.max(0.001, phase.end - phase.start)));
  const previousPose = previous.camera === 'wide' ? WIDE : previous.camera === 'approach' ? APPROACH : previous.camera === 'hero' ? HERO : PULLBACK;
  return lerpPose(previousPose, current, Math.min(1, Math.max(0, (value - phase.start) / Math.max(0.001, phase.end - phase.start))));
}
