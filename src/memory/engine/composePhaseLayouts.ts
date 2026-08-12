import type { Memory } from '../../domain/memory';
import type { MemoryTemplateConfig, TemplateTransform, TimelinePhase } from '../types';
import { packJustifiedPhotoRows, type PackedPhotoSlot } from '../layouts/slotPacking';
import { dimensions } from '../layouts/shared';
import type { PreparedTemplateLayouts } from './LayoutEngine';
import { seededSigned, seededUnit } from './seededRandom';

export type PhaseLayoutMap = Readonly<Record<string, Readonly<Record<string, TemplateTransform>>>>;

export interface CompositionViewport {
  /** Width / height of the target frame, not device pixels per CSS pixel. */
  aspect?: number;
}

export interface CompositionBounds {
  maxWidth: number;
  maxHeight: number;
}

// Keep the story as a deliberate composition instead of stretching it across
// the whole desktop. The desktop frame is only slightly larger than the
// original so individual photos gain readability without turning every scene
// into one long horizontal strip.
const MAX_FRAME_WIDTH = 15.1;
const MAX_FRAME_HEIGHT = 6.05;
const FRAME_GAP = 0.065;

export type GeometricSurfaceKind = 'sphere' | 'star' | 'torus' | 'prism';

/**
 * Some chapters keep a semantic galaxy/helix layout for their entry path but
 * are authored as a named 3D volume (for example prism-turn).  Resolve that
 * visual language in one place so packing, depth, card normals and runtime
 * safety all agree about what the viewer is meant to see.
 */
export function geometricSurfaceKind(phase: TimelinePhase): GeometricSurfaceKind | null {
  if (phase.layout === 'sphere' || phase.motion === 'sphere-pulse') return 'sphere';
  if (phase.layout === 'star' || phase.motion === 'star-ignite' || phase.motion === 'starburst-lane') return 'star';
  if (phase.layout === 'torus' || phase.motion === 'torus-spin' || phase.motion === 'ring-collapse') return 'torus';
  if (phase.layout === 'prism' || phase.motion === 'prism-fold' || phase.motion === 'prism-turn') return 'prism';
  return null;
}

function usesGeometricSurfacePacking(phase: TimelinePhase): boolean {
  return geometricSurfaceKind(phase) !== null;
}

function usesOrganicSurfacePacking(phase: TimelinePhase): boolean {
  // A packed surface is only appropriate when the surface itself is the
  // intended visual language. Applying it to every dense phase flattened
  // orbit, gravity, cascade and helix into the same long strip.
  return phase.layout === 'wave' || phase.motion === 'cylinder-roll';
}

/**
 * Returns the safe world-space frame for a target aspect ratio. The camera
 * keeps roughly 7.4 world units of vertical coverage; using the target aspect
 * here prevents a portrait phone/export frame from laying photos in a wide
 * desktop strip that is technically rendered but practically off-screen.
 */
export function compositionBounds(aspect = 16 / 9): CompositionBounds {
  const safeAspect = Math.max(0.28, Math.min(2.4, Number.isFinite(aspect) ? aspect : 16 / 9));
  const portrait = safeAspect < 0.9;
  return {
    maxWidth: Math.max(1.6, Math.min(MAX_FRAME_WIDTH, 8.2 * safeAspect * 0.97)),
    maxHeight: portrait ? 7.05 : MAX_FRAME_HEIGHT,
  };
}

function phaseWindowIndices(total: number, phase: TimelinePhase): number[] {
  if (total <= 0) return [];
  const count = Math.max(0, Math.min(total, phase.visibleCount ?? total));
  if (count >= total) return Array.from({ length: total }, (_, index) => index);
  const offset = ((phase.photoOffset ?? 0) % total + total) % total;
  return Array.from({ length: count }, (_, index) => (offset + index) % total);
}

function activeMemories(
  memories: readonly Memory[],
  phase: TimelinePhase,
  heroPhotoId: string | null,
): Memory[] {
  // Preserve the circular order of a chapter window. Filtering the original
  // array made a window such as [95, 0..38] become [0..38, 95], which placed
  // the wrapped final photo as a lone tail in a separate justified row.
  const selected = phaseWindowIndices(memories.length, phase);
  if (phase.layout === 'spotlight' && heroPhotoId) {
    const heroIndex = memories.findIndex((memory) => memory.id === heroPhotoId);
    if (heroIndex >= 0 && !selected.includes(heroIndex)) selected.unshift(heroIndex);
  }
  return selected
    .map((index) => memories[index])
    .filter((memory): memory is Memory => Boolean(memory));
}

function safeDepth(base: TemplateTransform | undefined, index: number, seed: number, hero: boolean): number {
  const sourceDepth = base?.position[2] ?? -1;
  const depth = -1.12 + Math.max(-0.32, Math.min(0.42, sourceDepth * 0.12));
  return depth + seededSigned(`${String(index)}:${String(seed)}`, seed + 31) * 0.06 + (hero ? 0.45 : 0);
}

interface LayoutBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

function boundsForActive(
  active: readonly Memory[],
  base: Readonly<Record<string, TemplateTransform>>,
): LayoutBounds {
  return active.reduce<LayoutBounds>((bounds, memory) => {
    const transform = base[memory.id];
    if (!transform) return bounds;
    const [width, height] = dimensions(memory);
    const halfWidth = width * transform.scale * 0.5;
    const halfHeight = height * transform.scale * 0.5;
    return {
      minX: Math.min(bounds.minX, transform.position[0] - halfWidth),
      maxX: Math.max(bounds.maxX, transform.position[0] + halfWidth),
      minY: Math.min(bounds.minY, transform.position[1] - halfHeight),
      maxY: Math.max(bounds.maxY, transform.position[1] + halfHeight),
    };
  }, {
    minX: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
  });
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function densityScaleForLayout(phase: TimelinePhase): number {
  // Dense chapters should read as one intentional 3D volume. A wide orbit
  // with tiny cards looks like isolated thumbnails even when every point is
  // technically connected in world space, so compact the silhouette first
  // and let the collision pass preserve the individual photo boundaries.
  if (phase.layout === 'scattered') return 0.52;
  if (phase.layout === 'sphere' || phase.layout === 'star' || phase.layout === 'torus' || phase.layout === 'prism') return 0.58;
  if (phase.layout === 'galaxy' || phase.layout === 'helix' || phase.layout === 'orbit') return 0.62;
  if (phase.layout === 'tunnel' || phase.layout === 'ribbon') return 0.64;
  if (phase.layout === 'wave') return 0.7;
  return 0.68;
}

function crowdingScaleForPhase(phase: TimelinePhase): number {
  const visibleCount = phase.visibleCount ?? 0;
  if (phase.layout === 'spotlight') return visibleCount >= 12 ? 0.86 : 0.94;
  if (visibleCount < 30) return 0.9;
  // A dense chapter should read as a spatial volume, not as a stack of
  // oversized thumbnails. More photos means a controlled reduction in card
  // scale, while native aspect ratios remain untouched.
  return clamp(0.74 + Math.max(0, 44 - visibleCount) * 0.004, 0.7, 0.8);
}

function cameraFitScaleForPhase(phase: TimelinePhase): number {
  // The authored layouts share one world-space frame, but dive/track/top-down
  // cameras move materially closer than the wide camera. Fit the composition
  // to the actual lens so a 3D scene never clips at the screen edge.
  if (phase.camera === 'dive') return 0.62;
  if (phase.camera === 'top-down') return 0.72;
  if (phase.camera === 'approach') return 0.76;
  if (phase.camera === 'track-left' || phase.camera === 'track-right') return 0.74;
  return 1;
}

function separateOverlappingComposition(
  active: readonly Memory[],
  composed: Record<string, TemplateTransform>,
  frame: CompositionBounds,
  phase: TimelinePhase,
  heroPhotoId: string | null,
  seed: number,
): void {
  const entries = active
    .map((memory) => ({ memory, transform: composed[memory.id] }))
    .filter((entry): entry is { memory: Memory; transform: TemplateTransform } => Boolean(entry.transform));
  if (entries.length <= 1) return;

  const gap = phase.layout === 'sphere' || phase.layout === 'star' || phase.layout === 'torus' || phase.layout === 'prism'
    ? 0.1
    : 0.055;

  // Resolve only the worst overlap at a time. The bounded iterations preserve
  // the authored silhouette while preventing a chapter from collapsing into a
  // stack of cards. Depth remains available for 3D perspective; separation is
  // measured in the camera-facing x/y plane so it is also true in export.
  for (let pass = 0; pass < 80; pass += 1) {
    for (let leftIndex = 0; leftIndex < entries.length; leftIndex += 1) {
      const left = entries[leftIndex];
      if (!left) continue;
      const [leftWidth, leftHeight] = dimensions(left.memory);
      const leftHalfWidth = leftWidth * left.transform.scale * 0.5;
      const leftHalfHeight = leftHeight * left.transform.scale * 0.5;
      for (let rightIndex = leftIndex + 1; rightIndex < entries.length; rightIndex += 1) {
        const right = entries[rightIndex];
        if (!right) continue;
        const [rightWidth, rightHeight] = dimensions(right.memory);
        const rightHalfWidth = rightWidth * right.transform.scale * 0.5;
        const rightHalfHeight = rightHeight * right.transform.scale * 0.5;
        const dx = right.transform.position[0] - left.transform.position[0];
        const dy = right.transform.position[1] - left.transform.position[1];
        const overlapX = leftHalfWidth + rightHalfWidth + gap - Math.abs(dx);
        const overlapY = leftHalfHeight + rightHalfHeight + gap - Math.abs(dy);
        if (overlapX <= 0 || overlapY <= 0) continue;

        const pushOnX = overlapX < overlapY || Math.abs(overlapX - overlapY) < 0.12;
        const sign = pushOnX
          ? (dx === 0 ? (seededSigned(`${left.memory.id}:${right.memory.id}`, seed + pass) >= 0 ? 1 : -1) : Math.sign(dx))
          : (dy === 0 ? (seededSigned(`${left.memory.id}:${right.memory.id}`, seed + pass + 17) >= 0 ? 1 : -1) : Math.sign(dy));
        const amount = Math.min(0.42, (pushOnX ? overlapX : overlapY) * 0.56);
        const leftIsHero = left.memory.id === heroPhotoId && phase.layout === 'spotlight';
        const rightIsHero = right.memory.id === heroPhotoId && phase.layout === 'spotlight';
        const moveLeft = leftIsHero ? 0 : rightIsHero ? 1 : 0.5;
        const moveRight = rightIsHero ? 0 : leftIsHero ? 1 : 0.5;
        const leftPosition = left.transform.position;
        const rightPosition = right.transform.position;
        const deltaX = pushOnX ? sign * amount : 0;
        const deltaY = pushOnX ? 0 : sign * amount;
        composed[left.memory.id] = {
          ...left.transform,
          position: [
            leftPosition[0] - deltaX * moveLeft,
            leftPosition[1] - deltaY * moveLeft,
            leftPosition[2],
          ],
        };
        composed[right.memory.id] = {
          ...right.transform,
          position: [
            rightPosition[0] + deltaX * moveRight,
            rightPosition[1] + deltaY * moveRight,
            rightPosition[2],
          ],
        };
        left.transform = composed[left.memory.id] as TemplateTransform;
        right.transform = composed[right.memory.id] as TemplateTransform;
      }
    }
  }

  for (const entry of entries) {
    const [width, height] = dimensions(entry.memory);
    const halfWidth = width * entry.transform.scale * 0.5;
    const halfHeight = height * entry.transform.scale * 0.5;
    const current = composed[entry.memory.id] ?? entry.transform;
    composed[entry.memory.id] = {
      ...current,
      position: [
        clamp(current.position[0], -frame.maxWidth * 0.5 + halfWidth, frame.maxWidth * 0.5 - halfWidth),
        clamp(current.position[1], -frame.maxHeight * 0.5 + halfHeight, frame.maxHeight * 0.5 - halfHeight),
        current.position[2],
      ],
    };
  }
}

/**
 * Keeps the authored shape of wave/orbit/helix/tunnel/deck layouts while
 * fitting only the active window into the current frame. This is deliberately
 * separate from the justified mosaic packer: every chapter must retain its
 * own silhouette and its imported photos must retain their native aspect.
 */
function compactAuthoredTransform(
  memory: Memory,
  base: TemplateTransform,
  bounds: LayoutBounds,
  frame: CompositionBounds,
  index: number,
  phase: TimelinePhase,
  seed: number,
  heroPhotoId: string | null,
): TemplateTransform {
  const rawWidth = Math.max(0.001, bounds.maxX - bounds.minX);
  const rawHeight = Math.max(0.001, bounds.maxY - bounds.minY);
  const horizontalScale = clamp((frame.maxWidth * 0.94) / rawWidth, 0.12, 1.12);
  const verticalScale = clamp((frame.maxHeight * 0.9) / rawHeight, 0.12, 1.12);
  const photoScale = Math.min(1, horizontalScale, verticalScale);
  const hero = memory.id === heroPhotoId && phase.layout === 'spotlight';
  const spotlightSupport = phase.layout === 'spotlight' && !hero;
  // Spotlight is the only chapter allowed to have a hero, but its supporting
  // photos still form one readable cluster. This keeps the opening from
  // looking like a central poster with unrelated one-photo islands around it.
  const spotlightSpread = spotlightSupport ? 0.58 : 1;
  const sourceRotation = base.rotation;
  const sizeVariation = 0.9 + seededUnit(memory.id, seed + 701 + index) * 0.18;
  const densityScale = densityScaleForLayout(phase);
  const crowdingScale = crowdingScaleForPhase(phase);
  const cameraFitScale = cameraFitScaleForPhase(phase);
  // `rain-drop` is authored as a wide falling field. Its track camera already
  // provides the needed framing; applying the generic compact-layout scale
  // and the track camera scale a second time shrinks the whole chapter into a
  // tiny island in the middle of the starfield. Keep its field wide and let
  // the card-size crowding rule handle readability independently.
  // The cascade chapter uses the same top-down camera family, but it is a
  // dense authored composition rather than a distant overview. Applying both
  // the density scale and the top-down camera scale made the whole chapter
  // read as a tiny island. Give this chapter back a readable desktop scale;
  // the separation pass below still owns collision safety and frame clamping.
  const isCascadeChapter = phase.layout === 'cascade';
  const authoredPositionScale = phase.motion === 'rain-drop'
    ? 1.38
    : isCascadeChapter
      ? 1.5
      : densityScale * cameraFitScale;
  const authoredCardCameraScale = phase.motion === 'rain-drop'
    ? 1
    : isCascadeChapter
      ? 0.98
      : cameraFitScale;
  const [x, y, z] = base.position;
  return {
    position: [
      (x - (bounds.minX + bounds.maxX) * 0.5) * horizontalScale * authoredPositionScale * spotlightSpread,
      (y - (bounds.minY + bounds.maxY) * 0.5) * verticalScale * authoredPositionScale * spotlightSpread,
      clamp(z, -3.9, 2.1) + (hero ? 0.45 : 0),
    ],
    rotation: [
      clamp(sourceRotation[0], -0.18, 0.18),
      clamp(sourceRotation[1], -0.32, 0.32),
      clamp(sourceRotation[2], -0.22, 0.22),
    ],
    // The scalar changes the size, while dimensions(memory) in MemoryPhoto
    // keeps every portrait, square and panorama in its original ratio.
    scale: base.scale * photoScale * sizeVariation * crowdingScale * authoredCardCameraScale * (hero ? 1.28 / crowdingScale : spotlightSupport ? 1.08 : 1),
    // Preserve the intentional near-invisible opening supports. Every other
    // authored chapter retains the normal readability floor.
    opacity: spotlightSupport ? base.opacity : Math.max(0.74, base.opacity),
  };
}

function cohereAuthoredComposition(
  active: readonly Memory[],
  composed: Record<string, TemplateTransform>,
  frame: CompositionBounds,
  phase: TimelinePhase,
  heroPhotoId: string | null,
): void {
  const entries = active
    .map((memory) => ({ memory, transform: composed[memory.id] }))
    .filter((entry): entry is { memory: Memory; transform: TemplateTransform } => Boolean(entry.transform));
  if (entries.length <= 2) return;

  // Pull every authored silhouette toward one shared visual mass. The small
  // repeated pull closes holes between source clusters while preserving the
  // layout's direction, rotation and native photo ratios.
  for (let pass = 0; pass < 6; pass += 1) {
    const centroid = entries.reduce<[number, number]>((sum, entry) => [
      sum[0] + entry.transform.position[0] / entries.length,
      sum[1] + entry.transform.position[1] / entries.length,
    ], [0, 0]);
    for (const entry of entries) {
      const isHero = entry.memory.id === heroPhotoId && phase.layout === 'spotlight';
      if (isHero) continue;
      const [x, y, z] = entry.transform.position;
      let nearest: { x: number; y: number; distance: number } | null = null;
      for (const candidate of entries) {
        if (candidate.memory.id === entry.memory.id) continue;
        const dx = candidate.transform.position[0] - x;
        const dy = candidate.transform.position[1] - y;
        const distance = Math.hypot(dx, dy);
        if (!nearest || distance < nearest.distance) nearest = { x: candidate.transform.position[0], y: candidate.transform.position[1], distance };
      }
      const [width, height] = dimensions(entry.memory);
      const photoSpan = Math.max(width, height) * entry.transform.scale;
      const desiredNeighborDistance = Math.max(0.92, Math.min(1.7, photoSpan * 1.55 + 0.32));
      const nearestPull = phase.layout === 'cascade'
        ? 0
        : nearest && nearest.distance > desiredNeighborDistance
          ? clamp((nearest.distance - desiredNeighborDistance) / Math.max(0.001, nearest.distance) * 0.3, 0.05, 0.3)
          : 0;
      // Cascade is already packed into justified rows. The generic six-pass
      // centroid pull was collapsing those rows into a small central island
      // after the top-down scale had been restored. Keep a light cohesion
      // pass for cascade, while leaving the other authored silhouettes intact.
      const centroidPull = phase.layout === 'scattered'
        ? 0.22
        : phase.layout === 'cascade'
          ? 0.02
          : 0.14;
      const pull = Math.max(nearestPull, centroidPull);
      const targetX = nearestPull > 0 && nearest ? nearest.x : centroid[0];
      const targetY = nearestPull > 0 && nearest ? nearest.y : centroid[1];
      composed[entry.memory.id] = {
        ...entry.transform,
        position: [
          x + (targetX - x) * pull,
          y + (targetY - y) * pull,
          z,
        ],
      };
    }
  }

  for (const entry of entries) {
    const [width, height] = dimensions(entry.memory);
    const halfWidth = width * entry.transform.scale * 0.5;
    const halfHeight = height * entry.transform.scale * 0.5;
    const current = composed[entry.memory.id] ?? entry.transform;
    const [x, y, z] = current.position;
    composed[entry.memory.id] = {
      ...current,
      position: [
        clamp(x, -frame.maxWidth * 0.5 + halfWidth, frame.maxWidth * 0.5 - halfWidth),
        clamp(y, -frame.maxHeight * 0.5 + halfHeight, frame.maxHeight * 0.5 - halfHeight),
        z,
      ],
    };
  }
}

export interface CompositionContinuityDiagnostics {
  maxNearestDistance: number;
  isolatedCount: number;
}

export function compositionContinuityDiagnostics(
  memories: readonly Memory[],
  transforms: Readonly<Record<string, TemplateTransform>>,
): CompositionContinuityDiagnostics {
  const entries = memories
    .map((memory) => ({ memory, transform: transforms[memory.id] }))
    .filter((entry): entry is { memory: Memory; transform: TemplateTransform } => Boolean(entry.transform));
  let maxNearestDistance = 0;
  let isolatedCount = 0;
  for (const entry of entries) {
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const candidate of entries) {
      if (candidate.memory.id === entry.memory.id) continue;
      nearestDistance = Math.min(nearestDistance, Math.hypot(
        candidate.transform.position[0] - entry.transform.position[0],
        candidate.transform.position[1] - entry.transform.position[1],
      ));
    }
    maxNearestDistance = Math.max(maxNearestDistance, nearestDistance);
    const [width, height] = dimensions(entry.memory);
    const threshold = Math.max(1.65, Math.max(width, height) * entry.transform.scale * 2.4 + 0.5);
    if (nearestDistance > threshold) isolatedCount += 1;
  }
  return { maxNearestDistance, isolatedCount };
}

function denseTransform(
  memory: Memory,
  base: TemplateTransform | undefined,
  slot: PackedPhotoSlot,
  index: number,
  phase: TimelinePhase,
  seed: number,
  heroPhotoId: string | null,
  surfacePacked = false,
  geometricSurface = false,
): TemplateTransform {
  const hero = memory.id === heroPhotoId && phase.layout === 'spotlight';
  const sourceRotation = base?.rotation ?? [0, 0, 0];
  const scaleMultiplier = hero ? 1.2 : phase.layout === 'spotlight' ? 0.96 : 1;
  // Both a justified mosaic and a geometric surface are packed against the
  // actual frame. Applying the authored camera scale again would compress
  // the cards into a stack and make the collision solver push them outward.
  const cameraFitScale = surfacePacked || phase.layout === 'mosaic' ? 1 : cameraFitScaleForPhase(phase);
  if (surfacePacked) {
    const normalizedX = clamp(slot.position[0] / 4.4, -1, 1);
    const normalizedY = clamp(slot.position[1] / 2.4, -1, 1);
    const surfacePhase = slot.row * 0.64 + slot.column * 0.18 + seed * 0.01;
    const radialDistance = Math.min(1, Math.hypot(normalizedX, normalizedY));
    const polarAngle = Math.atan2(normalizedY, normalizedX);
    const cylindricalSurface = phase.motion === 'cylinder-roll';
    const geometricKind = geometricSurfaceKind(phase);
    const cylinderAngle = normalizedX * 1.28;
    // The four named scenes are photo-built volumes. Their curved depth and
    // normal-driven card rotation make the shape legible with no decorative
    // helper layer or drawn orbital track in the export.
    const geometricDepth = geometricKind === 'sphere'
      ? (1 - radialDistance * radialDistance) * 1.08
      : geometricKind === 'torus'
        ? Math.sin(normalizedX * Math.PI * 1.22 + normalizedY * 0.84 + surfacePhase * 0.2) * 0.72
        : geometricKind === 'star'
          ? Math.cos(polarAngle * 5) * (0.5 + (1 - radialDistance) * 0.28)
          : (Math.abs(normalizedX) * 0.58 + Math.abs(normalizedY) * 0.26 - 0.42);
    const organicDepth = phase.layout === 'orbit'
      ? Math.cos(normalizedX * Math.PI * 0.78) * 0.7
      : phase.layout === 'wave'
        ? Math.cos(normalizedX * Math.PI * 1.18 + surfacePhase * 0.2) * 0.92
      : phase.layout === 'helix'
        ? normalizedY * 0.72 + Math.sin(surfacePhase) * 0.22
        : phase.layout === 'galaxy'
          ? (1 - radialDistance) * 0.8 + Math.sin(polarAngle * 2 + surfacePhase * 0.2) * 0.14
          : phase.layout === 'tunnel'
            ? normalizedY * 0.76
            : phase.layout === 'ribbon'
              ? Math.sin(normalizedX * Math.PI * 1.32 + surfacePhase * 0.28) * 0.62
              : phase.layout === 'cascade'
                ? -normalizedY * 0.62 + Math.sin(surfacePhase) * 0.1
                : phase.layout === 'deck'
                  ? ((slot.row + slot.column) % 3 - 1) * 0.32
                  : phase.layout === 'gravity'
                    ? -normalizedY * 0.46
                    : Math.sin(surfacePhase * 1.45 + normalizedX * 2) * 0.36;
    const rotationStrength = geometricSurface
      ? geometricKind === 'sphere'
        ? 0.52
        : geometricKind === 'torus'
          ? 0.42
          : geometricKind === 'star'
            ? 0.36
            : 0.4
      : phase.layout === 'helix' || phase.layout === 'tunnel'
        ? 0.38
        : 0.26;
    // Organic chapters remain a single connected surface, but their rows are
    // gently warped into an arc, spiral or ribbon silhouette. The offsets are
    // deliberately smaller than a photo gap: the arrangement gains a real
    // spatial read without opening holes between neighbouring photographs.
    const organicOffset = phase.layout === 'orbit'
      ? [normalizedY * 0.18, Math.sin(normalizedX * Math.PI) * 0.48] as const
      : phase.layout === 'wave'
        ? [0, Math.sin(normalizedX * Math.PI * 1.18) * 0.66] as const
      : phase.layout === 'helix'
        ? [normalizedY * 0.34, Math.sin(normalizedX * Math.PI * 1.2) * 0.46] as const
        : phase.layout === 'galaxy'
          ? [Math.sin(normalizedY * Math.PI) * 0.22, Math.sin(normalizedX * Math.PI) * 0.44] as const
          : phase.layout === 'ribbon'
            ? [0, Math.sin(normalizedX * Math.PI * 1.3) * 0.62] as const
            : phase.layout === 'tunnel'
              ? [normalizedY * 0.42, 0] as const
              : phase.layout === 'scattered'
                ? [Math.sin(surfacePhase * 1.4) * 0.1, Math.cos(surfacePhase * 1.2) * 0.12] as const
                : [0, 0] as const;
    const [surfaceOffsetX, surfaceOffsetY] = geometricSurface ? [0, 0] : organicOffset;
    let surfaceX = cylindricalSurface
      ? Math.sin(cylinderAngle) * 4.75
      : slot.position[0] + surfaceOffsetX;
    let surfaceY = slot.position[1] + surfaceOffsetY;
    if (geometricSurface) {
      // Depth alone is too subtle on camera-facing photo cards. Give the
      // outside of each named form a restrained silhouette as well, while
      // retaining the justified rows underneath so the photo surface stays
      // continuous instead of turning into scattered points.
      if (geometricKind === 'sphere') {
        const latitudeCompression = 0.88 + (1 - Math.abs(normalizedY)) * 0.1;
        surfaceX *= latitudeCompression;
        surfaceY *= 0.92;
      } else if (geometricKind === 'star') {
        // Preserve the packed surface's minimum radius. The old 0.66 inner
        // envelope pulled whole rows together and made the star read as a
        // pile of overlapping cards. A restrained outward five-point wave is
        // still recognisable, but never collapses the photo surface.
        const fivePointEnvelope = 1 + Math.cos(polarAngle * 5 - Math.PI / 2) * 0.07;
        surfaceX *= fivePointEnvelope;
        surfaceY *= fivePointEnvelope;
      } else if (geometricKind === 'torus') {
        surfaceX += Math.sin(normalizedY * Math.PI) * 0.28;
        surfaceY += Math.sin(normalizedX * Math.PI) * 0.18;
      } else if (geometricKind === 'prism') {
        surfaceX += Math.sign(normalizedX || 1) * Math.abs(normalizedY) * 0.26;
        surfaceY *= 0.9;
      }
    }
    const surfaceDepth = cylindricalSurface
      ? Math.cos(cylinderAngle) * 1.36
      : geometricSurface ? geometricDepth : organicDepth;
    return {
      // Keep x/y packing exact: this is the hard guarantee that a surface
      // chapter has no empty slot, lone final card or accidental overlap. The
      // depth field, rotation and motion trajectory provide the 3D read.
      position: [
        surfaceX,
        surfaceY,
        safeDepth(base, index, seed, hero) + surfaceDepth,
      ],
      rotation: [
        clamp(sourceRotation[0] * 0.28 + normalizedY * rotationStrength * 0.46, -0.28, 0.28),
        clamp(
          sourceRotation[1] * 0.24
            - normalizedX * rotationStrength
            - (cylindricalSurface ? normalizedX * 0.52 : 0),
          -0.76,
          0.76,
        ),
        clamp(sourceRotation[2] * 0.55 + Math.sin(surfacePhase) * 0.045, -0.12, 0.12),
      ],
      // Geometry slightly reserves more breathing room than a flat mosaic.
      // The silhouette warp compresses some rows in screen space; without this
      // allowance an expanding sphere/torus visually overlaps even though the
      // original justified slots had a gap.
      scale: slot.scale * scaleMultiplier * (cylindricalSurface ? 0.82 : geometricSurface ? 0.86 : 0.9),
      opacity: Math.max(0.78, base?.opacity ?? (hero ? 1 : 0.9)),
    };
  }
  return {
    position: [slot.position[0] * cameraFitScale, slot.position[1] * cameraFitScale, safeDepth(base, index, seed, hero)],
    rotation: [
      Math.max(-0.08, Math.min(0.08, sourceRotation[0] * 0.45)),
      Math.max(-0.16, Math.min(0.16, sourceRotation[1] * 0.42)),
      Math.max(-0.12, Math.min(0.12, sourceRotation[2] * 0.7)),
    ],
    scale: slot.scale
      * cameraFitScale
      * scaleMultiplier
      * (0.9 + seededUnit(memory.id, seed + 211 + index) * 0.18),
    opacity: Math.max(0.78, base?.opacity ?? (hero ? 1 : 0.9)),
  };
}

/**
 * Reflows only the photos that are active in a timeline phase. The old engine
 * laid out all 96 memories first and then rendered a 40-photo window from that
 * full matrix, which created large empty bands and single-photo outliers.
 * Mosaic chapters receive a justified contact sheet, while every other
 * chapter keeps its authored silhouette and is only compacted into the safe
 * frame. Empty grid cells are never represented as renderable slots, and the
 * same square-looking layout is never forced onto the whole song.
 */
export function composePhaseLayouts(
  config: Pick<MemoryTemplateConfig, 'phases' | 'seed'>,
  memories: readonly Memory[],
  layouts: PreparedTemplateLayouts,
  heroPhotoId: string | null,
  viewport: CompositionViewport = {},
): PhaseLayoutMap {
  const result: Record<string, Readonly<Record<string, TemplateTransform>>> = {};
  const bounds = compositionBounds(viewport.aspect);
  const portrait = (viewport.aspect ?? 16 / 9) < 0.9;

  for (const phase of config.phases) {
    const base = layouts[phase.layout];
    const active = activeMemories(memories, phase, heroPhotoId);
    if (active.length <= 1) {
      result[phase.id] = base;
      continue;
    }

    const useMosaicPacking = phase.layout === 'mosaic';
    const useGeometricSurfacePacking = usesGeometricSurfacePacking(phase);
    const useOrganicSurfacePacking = usesOrganicSurfacePacking(phase);
    // Dense chapters use an occupied photo surface so they never develop
    // interior holes or isolated cards. Their distinct 3D read comes from
    // per-layout depth/rotation fields below, while the named geometry scenes
    // receive the stronger spherical, star, torus and prism treatment.
    const useSurfacePacking = useMosaicPacking || useGeometricSurfacePacking || useOrganicSurfacePacking;
    const slots = useSurfacePacking
      ? packJustifiedPhotoRows(active, {
          maxWidth: useGeometricSurfacePacking
            ? Math.min(bounds.maxWidth * 0.83, 10.2)
            : useOrganicSurfacePacking
              ? Math.min(bounds.maxWidth * 0.9, 12)
              : bounds.maxWidth,
          maxHeight: useGeometricSurfacePacking
            ? Math.min(bounds.maxHeight * 0.87, 5.05)
            : useOrganicSurfacePacking
              ? Math.min(bounds.maxHeight * 0.9, 5.2)
              : bounds.maxHeight,
          targetRowHeight: useGeometricSurfacePacking || useOrganicSurfacePacking
            ? portrait
              ? 0.58
              : useOrganicSurfacePacking ? 0.8 : 0.8
            : portrait
              ? active.length <= 16 ? 0.72 : 0.5
              : active.length <= 16 ? 1.18 : 0.98,
          gap: FRAME_GAP,
        })
      : null;
    const authoredBounds = boundsForActive(active, base);
    const composed: Record<string, TemplateTransform> = { ...base };
      active.forEach((memory, index) => {
      const source = base[memory.id];
      if (!source) return;
      if (slots) {
        const slot = slots[memory.id];
        if (!slot) return;
        composed[memory.id] = denseTransform(
          memory,
          source,
          slot,
          index,
          phase,
          config.seed,
          heroPhotoId,
          useSurfacePacking,
          useGeometricSurfacePacking,
        );
        return;
      }
      composed[memory.id] = compactAuthoredTransform(
        memory,
        source,
        authoredBounds,
        bounds,
        index,
        phase,
        config.seed,
        heroPhotoId,
        );
      });
      if (!useSurfacePacking) {
        cohereAuthoredComposition(active, composed, bounds, phase, heroPhotoId);
        separateOverlappingComposition(active, composed, bounds, phase, heroPhotoId, config.seed);
      }
      result[phase.id] = composed;
  }

  return result;
}
