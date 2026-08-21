import type { MemoryTemplateConfig, TemplateCameraId } from '../types';
import type { Vec3 } from '../../engine/layout/layoutTypes';
import { clamp01 } from './seededRandom';

export interface CameraPose {
  position: Vec3;
  target: Vec3;
  fov: number;
}

const WIDE: CameraPose = { position: [0, 0.3, 9.25], target: [0, 0, -0.7], fov: 44 };
const APPROACH: CameraPose = { position: [0.3, 0.18, 7.8], target: [0, 0, 0], fov: 42 };
const DIVE: CameraPose = { position: [0, 0.08, 5.9], target: [0, 0, -1], fov: 44 };
const TRACK_LEFT: CameraPose = { position: [-2.85, 0.28, 7.8], target: [0.3, -0.08, -0.35], fov: 41 };
const TRACK_RIGHT: CameraPose = { position: [2.85, -0.16, 7.7], target: [-0.28, 0.08, -0.35], fov: 41 };
const TOP_DOWN: CameraPose = { position: [0.12, 6.35, 4.05], target: [0, -0.15, -0.55], fov: 43 };
const HERO: CameraPose = { position: [0, 0.15, 5.7], target: [0, -0.08, 0.5], fov: 39 };
const HERO_OPENING: CameraPose = { position: [0, 0.15, 6.8], target: [0, -0.08, 0.5], fov: 40 };
const PULLBACK: CameraPose = { position: [0, 0.38, 10.8], target: [0, 0, -0.8], fov: 45 };
const HOOK_START: CameraPose = { position: [0, 0.14, 9.2], target: [0, 0, 1.7], fov: 43 };

function poseForCamera(camera: TemplateCameraId): CameraPose {
  if (camera === 'approach') return APPROACH;
  if (camera === 'dive') return DIVE;
  if (camera === 'track-left') return TRACK_LEFT;
  if (camera === 'track-right') return TRACK_RIGHT;
  if (camera === 'top-down') return TOP_DOWN;
  if (camera === 'hero') return HERO;
  if (camera === 'pullback') return PULLBACK;
  return WIDE;
}

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
  const current = poseForCamera(phase.camera);
  const index = config.phases.indexOf(phase);
  const previous = config.phases[index - 1];
  if (!previous) {
    const local = Math.min(1, (value - phase.start) / Math.max(0.001, phase.end - phase.start));
    const openingPose = phase.layout === 'spotlight'
      ? HERO_OPENING
      : phase.id === 'hook' ? HOOK_START : WIDE;
    return lerpPose(openingPose, current, local * local * (3 - 2 * local));
  }
  const previousPose = poseForCamera(previous.camera);
  const local = Math.min(1, Math.max(0, (value - phase.start) / Math.max(0.001, phase.end - phase.start)));
  const pose = lerpPose(previousPose, current, local * local * (3 - 2 * local));
  const arc = Math.sin(local * Math.PI);
  return {
    ...pose,
    position: [
      pose.position[0] + (phase.motion === 'cascade' ? arc * 0.28 : 0),
      pose.position[1] + (phase.motion === 'fly-through' ? arc * 0.22 : 0),
      pose.position[2],
    ],
    target: [
      pose.target[0],
      pose.target[1] + (phase.motion === 'ribbon-sweep' ? arc * 0.18 : 0),
      pose.target[2],
    ],
  };
}
