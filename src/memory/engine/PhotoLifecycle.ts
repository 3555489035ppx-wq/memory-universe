import type { PhotoLifecycleStage, TemplateTransform } from '../types';
import { seededSigned } from './seededRandom';

function smoothstep(value: number): number {
  const clamped = Math.min(1, Math.max(0, value));
  return clamped * clamped * (3 - 2 * clamped);
}

/**
 * Keeps a chapter hand-off readable instead of letting the next layout snap in
 * on the first frame. The duration is intentionally capped so a very short
 * song cannot become a permanent crossfade.
 */
export function crossfadeDurationSeconds(phaseSeconds: number): number {
  const safeSeconds = Math.max(0.1, Number.isFinite(phaseSeconds) ? phaseSeconds : 0.1);
  return Math.min(2.25, Math.max(1.55, safeSeconds * 0.34));
}

export function lifecycleOpacity(stage: PhotoLifecycleStage, progress: number): number {
  const clamped = Math.min(1, Math.max(0, progress));
  // New cards begin as a soft afterimage and become readable only once their
  // own stagger has joined the current composition. This prevents a late card
  // from flashing alone at the edge of a crossfade, while remaining a true
  // fade rather than a pop-in.
  if (stage === 'entering') return 0.14 + smoothstep(clamped) ** 1.2 * 0.86;
  if (stage === 'stable') return 1;
  if (stage === 'retained' || stage === 'released') return 0;
  // Begin the dissolve almost immediately, but keep the curve smooth across
  // the full exit window. This makes a photo leave with an afterimage instead
  // of holding at 100% and then disappearing near the end.
  if (clamped <= 0.06) return 1;
  return 1 - smoothstep((clamped - 0.06) / 0.94);
}

/** A restrained paper-like retreat used after the readable hold of an exit. */
export function applyPhotoExitTransform(
  transform: TemplateTransform,
  progress: number,
  memoryId: string,
  seed: number,
): TemplateTransform {
  const clamped = Math.min(1, Math.max(0, progress));
  const retreat = smoothstep(Math.max(0, (clamped - 0.18) / 0.82));
  const direction = seededSigned(memoryId, seed + 1_907);
  return {
    position: [
      transform.position[0] + direction * 0.22 * retreat,
      transform.position[1] + 0.08 * retreat,
      transform.position[2] - 1.35 * retreat,
    ],
    rotation: [
      transform.rotation[0],
      transform.rotation[1] + direction * 0.035 * retreat,
      transform.rotation[2] + direction * 0.07 * retreat,
    ],
    scale: transform.scale * (1 - 0.045 * retreat),
    opacity: transform.opacity * lifecycleOpacity('exiting', clamped),
  };
}
