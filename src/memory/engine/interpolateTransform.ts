import type { TemplateTransform } from '../types';
import { shortestAngle } from './easing';

function lerp(from: number, to: number, progress: number): number {
  return from + (to - from) * progress;
}

export function interpolateTransform(
  from: TemplateTransform,
  to: TemplateTransform,
  progress: number,
): TemplateTransform {
  return {
    position: [
      lerp(from.position[0], to.position[0], progress),
      lerp(from.position[1], to.position[1], progress),
      lerp(from.position[2], to.position[2], progress),
    ],
    rotation: [
      shortestAngle(from.rotation[0], to.rotation[0], progress),
      shortestAngle(from.rotation[1], to.rotation[1], progress),
      shortestAngle(from.rotation[2], to.rotation[2], progress),
    ],
    scale: lerp(from.scale, to.scale, progress),
    opacity: lerp(from.opacity, to.opacity, progress),
  };
}
