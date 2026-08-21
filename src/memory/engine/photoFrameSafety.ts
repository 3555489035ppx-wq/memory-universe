import type { Memory } from '../../domain/memory';
import { dimensions } from '../layouts/shared';
import type { TemplatePhotoState } from '../types';

export interface PhotoFrameSafetyOptions {
  maxWidth?: number;
  maxHeight?: number;
  gap?: number;
  /** Compress the camera-facing silhouette while preserving z-depth. */
  clusterFactor?: number;
  /** The current chapter is kept visually connected even during a crossfade. */
  activeMemoryIds?: readonly string[];
}

interface MutablePhoto {
  photo: TemplatePhotoState;
  memory: Memory;
  movable: boolean;
}

export interface PhotoFrameSafetyOffset {
  x: number;
  y: number;
  z: number;
  scaleMultiplier: number;
}

const SAFETY_OFFSET_EPSILON = 0.0008;

/** Smoothly moves a collision correction toward a new target. */
export function blendPhotoFrameSafetyOffsets(
  current: ReadonlyMap<string, PhotoFrameSafetyOffset>,
  target: ReadonlyMap<string, PhotoFrameSafetyOffset>,
  amount: number,
): ReadonlyMap<string, PhotoFrameSafetyOffset> {
  const alpha = Math.min(1, Math.max(0, amount));
  const ids = new Set([...current.keys(), ...target.keys()]);
  const blended = new Map<string, PhotoFrameSafetyOffset>();
  for (const id of ids) {
    const from = current.get(id) ?? { x: 0, y: 0, z: 0, scaleMultiplier: 1 };
    const to = target.get(id) ?? { x: 0, y: 0, z: 0, scaleMultiplier: 1 };
    const next = {
      x: from.x + (to.x - from.x) * alpha,
      y: from.y + (to.y - from.y) * alpha,
      z: from.z + (to.z - from.z) * alpha,
      scaleMultiplier: from.scaleMultiplier + (to.scaleMultiplier - from.scaleMultiplier) * alpha,
    };
    if (
      Math.abs(next.x) > SAFETY_OFFSET_EPSILON
      || Math.abs(next.y) > SAFETY_OFFSET_EPSILON
      || Math.abs(next.z) > SAFETY_OFFSET_EPSILON
      || Math.abs(next.scaleMultiplier - 1) > SAFETY_OFFSET_EPSILON
    ) {
      blended.set(id, next);
    }
  }
  return blended;
}

export function hasMeaningfulPhotoFrameSafetyOffsets(
  offsets: ReadonlyMap<string, PhotoFrameSafetyOffset>,
): boolean {
  for (const offset of offsets.values()) {
    if (
      Math.abs(offset.x) > SAFETY_OFFSET_EPSILON
      || Math.abs(offset.y) > SAFETY_OFFSET_EPSILON
      || Math.abs(offset.z) > SAFETY_OFFSET_EPSILON
      || Math.abs(offset.scaleMultiplier - 1) > SAFETY_OFFSET_EPSILON
    ) {
      return true;
    }
  }
  return false;
}

function clamp(value: number, minimum: number, maximum: number): number {
  if (minimum > maximum) return (minimum + maximum) * 0.5;
  return Math.min(maximum, Math.max(minimum, value));
}

function activeForSafety(photo: TemplatePhotoState): boolean {
  return (
    photo.lifecycle.stage !== 'released'
    && photo.transform.opacity >= 0.03
  );
}

function clonePhoto(photo: TemplatePhotoState): TemplatePhotoState {
  return {
    ...photo,
    transform: {
      ...photo.transform,
      position: [...photo.transform.position] as [number, number, number],
      rotation: [...photo.transform.rotation] as [number, number, number],
    },
  };
}

function connectionReach(entry: MutablePhoto): number {
  const [width, height] = dimensions(entry.memory);
  return Math.max(width, height) * entry.photo.transform.scale * 1.8 + 0.48;
}

function componentGroups(entries: readonly MutablePhoto[]): MutablePhoto[][] {
  const groups: MutablePhoto[][] = [];
  const visited = new Set<string>();
  for (const root of entries) {
    if (visited.has(root.memory.id)) continue;
    const group: MutablePhoto[] = [];
    const queue = [root];
    visited.add(root.memory.id);
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) continue;
      group.push(current);
      for (const candidate of entries) {
        if (visited.has(candidate.memory.id)) continue;
        const distance = Math.hypot(
          candidate.photo.transform.position[0] - current.photo.transform.position[0],
          candidate.photo.transform.position[1] - current.photo.transform.position[1],
        );
        if (distance <= Math.max(connectionReach(current), connectionReach(candidate))) {
          visited.add(candidate.memory.id);
          queue.push(candidate);
        }
      }
    }
    groups.push(group);
  }
  return groups;
}

function connectComponents(
  entries: MutablePhoto[],
  clampEntry: (entry: MutablePhoto) => void,
): void {
  for (let pass = 0; pass < 28; pass += 1) {
    const groups = componentGroups(entries);
    if (groups.length <= 1) return;
    const group = groups.toSorted((left, right) => left.length - right.length)[0];
    if (!group) return;
    const groupIds = new Set(group.map((entry) => entry.memory.id));
    let nearest: { source: MutablePhoto; target: MutablePhoto; distance: number } | null = null;
    for (const source of group) {
      for (const target of entries) {
        if (groupIds.has(target.memory.id)) continue;
        const distance = Math.hypot(
          target.photo.transform.position[0] - source.photo.transform.position[0],
          target.photo.transform.position[1] - source.photo.transform.position[1],
        );
        if (!nearest || distance < nearest.distance) nearest = { source, target, distance };
      }
    }
    if (!nearest) return;
    const dx = nearest.target.photo.transform.position[0] - nearest.source.photo.transform.position[0];
    const dy = nearest.target.photo.transform.position[1] - nearest.source.photo.transform.position[1];
    const distance = Math.max(0.001, Math.hypot(dx, dy));
    const [sourceWidth, sourceHeight] = dimensions(nearest.source.memory);
    const [targetWidth, targetHeight] = dimensions(nearest.target.memory);
    const sourceHalfWidth = sourceWidth * nearest.source.photo.transform.scale * 0.5;
    const sourceHalfHeight = sourceHeight * nearest.source.photo.transform.scale * 0.5;
    const targetHalfWidth = targetWidth * nearest.target.photo.transform.scale * 0.5;
    const targetHalfHeight = targetHeight * nearest.target.photo.transform.scale * 0.5;
    const safeDistance = Math.max(
      sourceHalfWidth + targetHalfWidth,
      sourceHalfHeight + targetHalfHeight,
    ) + 0.12;
    const amount = Math.min(0.48, Math.max(0.08, (distance - safeDistance) * 0.72));
    const unitX = dx / distance;
    const unitY = dy / distance;
    const moveGroup = group.every((entry) => entry.movable) || !nearest.target.movable;
    const movingEntries = moveGroup ? group : [nearest.target];
    const sign = moveGroup ? 1 : -1;
    for (const entry of movingEntries) {
      entry.photo.transform.position = [
        entry.photo.transform.position[0] + unitX * amount * sign,
        entry.photo.transform.position[1] + unitY * amount * sign,
        entry.photo.transform.position[2],
      ];
      clampEntry(entry);
    }
  }
}

function pullVisualOutliersIntoCore(
  entries: MutablePhoto[],
  clampEntry: (entry: MutablePhoto) => void,
): void {
  const core = entries.filter((entry) => entry.photo.transform.opacity >= 0.45);
  if (core.length <= 1) return;
  for (let pass = 0; pass < 14; pass += 1) {
    let moved = false;
    for (const entry of entries) {
      if (!entry.movable) continue;
      let nearest: { entry: MutablePhoto; distance: number } | null = null;
      for (const candidate of core) {
        if (candidate.memory.id === entry.memory.id) continue;
        const distance = Math.hypot(
          candidate.photo.transform.position[0] - entry.photo.transform.position[0],
          candidate.photo.transform.position[1] - entry.photo.transform.position[1],
        );
        if (!nearest || distance < nearest.distance) nearest = { entry: candidate, distance };
      }
      if (!nearest) continue;
      const [width, height] = dimensions(entry.memory);
      const visualLimit = Math.max(1.7, Math.max(width, height) * entry.photo.transform.scale * 2.2 + 0.38);
      if (nearest.distance <= visualLimit) continue;
      const dx = nearest.entry.photo.transform.position[0] - entry.photo.transform.position[0];
      const dy = nearest.entry.photo.transform.position[1] - entry.photo.transform.position[1];
      const distance = Math.max(0.001, nearest.distance);
      const amount = Math.min(0.38, (distance - visualLimit) * 0.45);
      entry.photo.transform.position = [
        entry.photo.transform.position[0] + dx / distance * amount,
        entry.photo.transform.position[1] + dy / distance * amount,
        entry.photo.transform.position[2],
      ];
      clampEntry(entry);
      moved = true;
    }
    if (!moved) break;
  }
}

function separateRemainingOverlaps(
  entries: MutablePhoto[],
  clampEntry: (entry: MutablePhoto) => void,
  gap: number,
): void {
  // The ordinary relaxation pass is intentionally gentle so it preserves the
  // authored motion. A second, conditional pass is a hard safety net for the
  // exact frame where a transition, a camera clamp and several incoming cards
  // all meet. It runs only while a real overlap remains, so stable frames do
  // not pay the cost on every render tick.
  let shrinkPass = 0;
  for (let pass = 0; pass < 36; pass += 1) {
    let unresolved = false;
    let moved = false;
    for (let leftIndex = 0; leftIndex < entries.length; leftIndex += 1) {
      const left = entries[leftIndex];
      if (!left) continue;
      const [leftWidth, leftHeight] = dimensions(left.memory);
      const leftHalfWidth = leftWidth * left.photo.transform.scale * 0.5;
      const leftHalfHeight = leftHeight * left.photo.transform.scale * 0.5;
      for (let rightIndex = leftIndex + 1; rightIndex < entries.length; rightIndex += 1) {
        const right = entries[rightIndex];
        if (!right) continue;
        const [rightWidth, rightHeight] = dimensions(right.memory);
        const rightHalfWidth = rightWidth * right.photo.transform.scale * 0.5;
        const rightHalfHeight = rightHeight * right.photo.transform.scale * 0.5;
        const dx = right.photo.transform.position[0] - left.photo.transform.position[0];
        const dy = right.photo.transform.position[1] - left.photo.transform.position[1];
        const overlapX = leftHalfWidth + rightHalfWidth + gap - Math.abs(dx);
        const overlapY = leftHalfHeight + rightHalfHeight + gap - Math.abs(dy);
        if (overlapX <= 0 || overlapY <= 0) continue;
        unresolved = true;

        const pushOnX = overlapX <= overlapY;
        const axisOverlap = pushOnX ? overlapX : overlapY;
        const direction = pushOnX
          ? (dx === 0 ? (leftIndex % 2 === 0 ? 1 : -1) : Math.sign(dx))
          : (dy === 0 ? (rightIndex % 2 === 0 ? 1 : -1) : Math.sign(dy));
        const amount = Math.min(0.56, axisOverlap + 0.018);
        const deltaX = pushOnX ? direction * amount : 0;
        const deltaY = pushOnX ? 0 : direction * amount;
        const leftWeight = left.movable ? (right.movable ? 0.5 : 0) : 0;
        const rightWeight = right.movable ? (left.movable ? 0.5 : 1) : 0;
        if (leftWeight > 0) {
          left.photo.transform.position = [
            left.photo.transform.position[0] - deltaX * leftWeight,
            left.photo.transform.position[1] - deltaY * leftWeight,
            left.photo.transform.position[2],
          ];
          clampEntry(left);
          moved = true;
        }
        if (rightWeight > 0) {
          right.photo.transform.position = [
            right.photo.transform.position[0] + deltaX * rightWeight,
            right.photo.transform.position[1] + deltaY * rightWeight,
            right.photo.transform.position[2],
          ];
          clampEntry(right);
          moved = true;
        }
      }
    }

    if (!unresolved) return;
    if (!moved && shrinkPass < 8) {
      for (const entry of entries) {
        if (!entry.movable) continue;
        entry.photo.transform.scale *= 0.94;
        clampEntry(entry);
      }
      shrinkPass += 1;
    } else if (pass > 0 && pass % 8 === 0 && shrinkPass < 8) {
      for (const entry of entries) {
        if (!entry.movable) continue;
        entry.photo.transform.scale *= 0.94;
        clampEntry(entry);
      }
      shrinkPass += 1;
    }
  }
}

function hasRemainingOverlap(entries: readonly MutablePhoto[], gap: number): boolean {
  for (let leftIndex = 0; leftIndex < entries.length; leftIndex += 1) {
    const left = entries[leftIndex];
    if (!left) continue;
    const [leftWidth, leftHeight] = dimensions(left.memory);
    for (let rightIndex = leftIndex + 1; rightIndex < entries.length; rightIndex += 1) {
      const right = entries[rightIndex];
      if (!right) continue;
      const [rightWidth, rightHeight] = dimensions(right.memory);
      const overlapX = leftWidth * left.photo.transform.scale * 0.5
        + rightWidth * right.photo.transform.scale * 0.5
        + gap
        - Math.abs(left.photo.transform.position[0] - right.photo.transform.position[0]);
      const overlapY = leftHeight * left.photo.transform.scale * 0.5
        + rightHeight * right.photo.transform.scale * 0.5
        + gap
        - Math.abs(left.photo.transform.position[1] - right.photo.transform.position[1]);
      if (overlapX > 0 && overlapY > 0) return true;
    }
  }
  return false;
}

/**
 * Keeps the authored motion while preventing a moving frame from collapsing
 * into a stack of cards. Static layout separation cannot catch this because
 * choreography is evaluated later and every photo receives its own offset.
 */
export function resolvePhotoFrameCollisions(
  photos: readonly TemplatePhotoState[],
  options: PhotoFrameSafetyOptions = {},
): TemplatePhotoState[] {
  const result = photos.map(clonePhoto);
  const maxWidth = Math.max(1.6, options.maxWidth ?? 10.8);
  const maxHeight = Math.max(1.6, options.maxHeight ?? 5.6);
  const gap = Math.max(0.025, options.gap ?? 0.055);
  const entries: MutablePhoto[] = result
    .filter(activeForSafety)
    .map((photo) => ({
      photo,
      memory: photo.memory,
      // A hero is anchored while it is the current focal point, but an
      // outgoing hero must also leave with the cluster instead of becoming a
      // lone corner card during the crossfade.
      movable: photo.emphasis !== 'hero' || photo.lifecycle.stage === 'exiting' || photo.lifecycle.stage === 'retained',
    }));
  if (entries.length <= 1) return result;

  const clusterFactor = clamp(options.clusterFactor ?? 1, 0.55, 1);
  if (clusterFactor < 0.999) {
    const centroid = entries.reduce<[number, number]>((sum, entry) => [
      sum[0] + entry.photo.transform.position[0] / entries.length,
      sum[1] + entry.photo.transform.position[1] / entries.length,
    ], [0, 0]);
    for (const entry of entries) {
      if (!entry.movable) continue;
      const [x, y, z] = entry.photo.transform.position;
      entry.photo.transform.position = [
        centroid[0] + (x - centroid[0]) * clusterFactor,
        centroid[1] + (y - centroid[1]) * clusterFactor,
        z,
      ];
    }
  }

  const clampEntry = (entry: MutablePhoto): void => {
    const [width, height] = dimensions(entry.memory);
    const halfWidth = width * entry.photo.transform.scale * 0.5;
    const halfHeight = height * entry.photo.transform.scale * 0.5;
    const position = entry.photo.transform.position;
    entry.photo.transform.position = [
      clamp(position[0], -maxWidth * 0.5 + halfWidth, maxWidth * 0.5 - halfWidth),
      clamp(position[1], -maxHeight * 0.5 + halfHeight, maxHeight * 0.5 - halfHeight),
      position[2],
    ];
  };

  // First repair the silhouette, then separate it. Doing these in this order
  // prevents the connectivity pass from reintroducing an overlap after the
  // collision pass has already finished.
  connectComponents(entries, clampEntry);
  pullVisualOutliersIntoCore(entries, clampEntry);

  // A bounded relaxation loop makes the per-frame choreography collision-aware
  // without rebuilding the authored layout. The strongest overlap is resolved
  // first, and all moves are clamped to the same safe frame used by composition.
  for (let pass = 0; pass < 24; pass += 1) {
    let changed = false;
    for (let leftIndex = 0; leftIndex < entries.length; leftIndex += 1) {
      const left = entries[leftIndex];
      if (!left) continue;
      const [leftWidth, leftHeight] = dimensions(left.memory);
      const leftHalfWidth = leftWidth * left.photo.transform.scale * 0.5;
      const leftHalfHeight = leftHeight * left.photo.transform.scale * 0.5;
      for (let rightIndex = leftIndex + 1; rightIndex < entries.length; rightIndex += 1) {
        const right = entries[rightIndex];
        if (!right) continue;
        const [rightWidth, rightHeight] = dimensions(right.memory);
        const rightHalfWidth = rightWidth * right.photo.transform.scale * 0.5;
        const rightHalfHeight = rightHeight * right.photo.transform.scale * 0.5;
        const dx = right.photo.transform.position[0] - left.photo.transform.position[0];
        const dy = right.photo.transform.position[1] - left.photo.transform.position[1];
        const overlapX = leftHalfWidth + rightHalfWidth + gap - Math.abs(dx);
        const overlapY = leftHalfHeight + rightHalfHeight + gap - Math.abs(dy);
        if (overlapX <= 0 || overlapY <= 0) continue;
        changed = true;

        const pushOnX = overlapX <= overlapY;
        const direction = pushOnX
          ? (dx === 0 ? (leftIndex % 2 === 0 ? 1 : -1) : Math.sign(dx))
          : (dy === 0 ? (rightIndex % 2 === 0 ? 1 : -1) : Math.sign(dy));
        const amount = Math.min(0.24, (pushOnX ? overlapX : overlapY) * 0.58);
        const deltaX = pushOnX ? direction * amount : 0;
        const deltaY = pushOnX ? 0 : direction * amount;
        const leftWeight = left.movable ? (right.movable ? 0.5 : 0) : 0;
        const rightWeight = right.movable ? (left.movable ? 0.5 : 1) : 0;
        if (leftWeight > 0) {
          left.photo.transform.position = [
            left.photo.transform.position[0] - deltaX * leftWeight,
            left.photo.transform.position[1] - deltaY * leftWeight,
            left.photo.transform.position[2],
          ];
        }
        if (rightWeight > 0) {
          right.photo.transform.position = [
            right.photo.transform.position[0] + deltaX * rightWeight,
            right.photo.transform.position[1] + deltaY * rightWeight,
            right.photo.transform.position[2],
          ];
        }
      }
    }
    for (const entry of entries) clampEntry(entry);
    if (!changed) break;
  }

  // If a dense phase reached the frame edge before all pairs could separate,
  // reduce only the active cards a little and run one final relaxation pass.
  // This preserves the native aspect ratio and avoids a single outlier being
  // pushed into a corner just to make the rest of the frame pass.
  for (let shrinkPass = 0; shrinkPass < 5; shrinkPass += 1) {
    let unresolved = false;
    for (let leftIndex = 0; leftIndex < entries.length; leftIndex += 1) {
      const left = entries[leftIndex];
      if (!left) continue;
      const [leftWidth, leftHeight] = dimensions(left.memory);
      const leftHalfWidth = leftWidth * left.photo.transform.scale * 0.5;
      const leftHalfHeight = leftHeight * left.photo.transform.scale * 0.5;
      for (let rightIndex = leftIndex + 1; rightIndex < entries.length; rightIndex += 1) {
        const right = entries[rightIndex];
        if (!right) continue;
        const [rightWidth, rightHeight] = dimensions(right.memory);
        const rightHalfWidth = rightWidth * right.photo.transform.scale * 0.5;
        const rightHalfHeight = rightHeight * right.photo.transform.scale * 0.5;
        const overlapX = leftHalfWidth + rightHalfWidth + gap - Math.abs(left.photo.transform.position[0] - right.photo.transform.position[0]);
        const overlapY = leftHalfHeight + rightHalfHeight + gap - Math.abs(left.photo.transform.position[1] - right.photo.transform.position[1]);
        if (overlapX > 0 && overlapY > 0) {
          unresolved = true;
          break;
        }
      }
      if (unresolved) break;
    }
    if (!unresolved) break;
    for (const entry of entries) {
      if (!entry.movable) continue;
      entry.photo.transform.scale *= 0.96;
      clampEntry(entry);
    }
    for (let pass = 0; pass < 12; pass += 1) {
      let changed = false;
      for (let leftIndex = 0; leftIndex < entries.length; leftIndex += 1) {
        const left = entries[leftIndex];
        if (!left) continue;
        const [leftWidth, leftHeight] = dimensions(left.memory);
        const leftHalfWidth = leftWidth * left.photo.transform.scale * 0.5;
        const leftHalfHeight = leftHeight * left.photo.transform.scale * 0.5;
        for (let rightIndex = leftIndex + 1; rightIndex < entries.length; rightIndex += 1) {
          const right = entries[rightIndex];
          if (!right) continue;
          const [rightWidth, rightHeight] = dimensions(right.memory);
          const rightHalfWidth = rightWidth * right.photo.transform.scale * 0.5;
          const rightHalfHeight = rightHeight * right.photo.transform.scale * 0.5;
          const dx = right.photo.transform.position[0] - left.photo.transform.position[0];
          const dy = right.photo.transform.position[1] - left.photo.transform.position[1];
          const overlapX = leftHalfWidth + rightHalfWidth + gap - Math.abs(dx);
          const overlapY = leftHalfHeight + rightHalfHeight + gap - Math.abs(dy);
          if (overlapX <= 0 || overlapY <= 0) continue;
          changed = true;
          const pushOnX = overlapX <= overlapY;
          const direction = pushOnX ? (dx === 0 ? 1 : Math.sign(dx)) : (dy === 0 ? 1 : Math.sign(dy));
          const amount = Math.min(0.2, (pushOnX ? overlapX : overlapY) * 0.62);
          const deltaX = pushOnX ? direction * amount : 0;
          const deltaY = pushOnX ? 0 : direction * amount;
          if (left.movable) left.photo.transform.position = [left.photo.transform.position[0] - deltaX * 0.5, left.photo.transform.position[1] - deltaY * 0.5, left.photo.transform.position[2]];
          if (right.movable) right.photo.transform.position = [right.photo.transform.position[0] + deltaX * 0.5, right.photo.transform.position[1] + deltaY * 0.5, right.photo.transform.position[2]];
        }
      }
      for (const entry of entries) clampEntry(entry);
      if (!changed) break;
    }
  }

  if (hasRemainingOverlap(entries, gap)) {
    separateRemainingOverlaps(entries, clampEntry, gap);
  }

  // Low-opacity remnants may bridge two unrelated groups mathematically while
  // remaining invisible to the user. Reconnect only the readable cards in the
  // current chapter, so it cannot leave a detached island behind during a fade.
  const activeIds = options.activeMemoryIds ? new Set(options.activeMemoryIds) : null;
  const visibleChapter = entries.filter((entry) => (
    // The render still reads a card once it passes 10% opacity. Keeping the
    // lower hand-off threshold here prevents a helix/wave transition from
    // leaving a faint but clearly visible detached island between scenes.
    entry.photo.transform.opacity >= 0.1
    && (!activeIds || activeIds.has(entry.memory.id))
  ));
  connectComponents(visibleChapter.length > 1 ? visibleChapter : entries.filter((entry) => entry.photo.transform.opacity >= 0.45), clampEntry);
  if (hasRemainingOverlap(entries, gap)) {
    separateRemainingOverlaps(entries, clampEntry, gap);
  }

  // Separation can legitimately move a current card away while making room
  // for an outgoing card. Rejoin only the readable current chapter as the
  // last operation: connectComponents uses a non-overlapping safe distance,
  // so this preserves the collision guarantee without allowing a visible
  // second island to survive the fade.
  if (visibleChapter.length > 1) {
    connectComponents(visibleChapter, clampEntry);
  }

  return result;
}

/**
 * Converts an expensive collision solve into stable per-photo offsets. The
 * render loop can then keep its authored motion continuous while applying the
 * same safe surface spacing each frame. This is deliberately used for the
 * compact 3D chapters rather than re-solving every animation tick.
 */
export function createPhotoFrameSafetyOffsets(
  photos: readonly TemplatePhotoState[],
  options: PhotoFrameSafetyOptions = {},
): ReadonlyMap<string, PhotoFrameSafetyOffset> {
  const safePhotos = resolvePhotoFrameCollisions(photos, options);
  const sourceById = new Map(photos.map((photo) => [photo.memory.id, photo]));
  const offsets = new Map<string, PhotoFrameSafetyOffset>();
  for (const safe of safePhotos) {
    const source = sourceById.get(safe.memory.id);
    if (!source) continue;
    const sourceScale = Math.max(0.0001, source.transform.scale);
    offsets.set(safe.memory.id, {
      x: safe.transform.position[0] - source.transform.position[0],
      y: safe.transform.position[1] - source.transform.position[1],
      z: safe.transform.position[2] - source.transform.position[2],
      scaleMultiplier: safe.transform.scale / sourceScale,
    });
  }
  return offsets;
}

export function applyPhotoFrameSafetyOffsets(
  photos: readonly TemplatePhotoState[],
  offsets: ReadonlyMap<string, PhotoFrameSafetyOffset>,
): TemplatePhotoState[] {
  if (offsets.size === 0) return [...photos];
  return photos.map((photo) => {
    const offset = offsets.get(photo.memory.id);
    if (!offset) return photo;
    return {
      ...photo,
      transform: {
        ...photo.transform,
        position: [
          photo.transform.position[0] + offset.x,
          photo.transform.position[1] + offset.y,
          photo.transform.position[2] + offset.z,
        ],
        scale: photo.transform.scale * offset.scaleMultiplier,
      },
    };
  });
}
