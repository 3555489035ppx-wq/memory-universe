import type { Vec3 } from '../../engine/layout/layoutTypes';
import type { CameraPose } from '../../memory/engine/CameraDirector';

export interface ProjectedPoint {
  x: number;
  y: number;
  depth: number;
  focalLength: number;
  visible: boolean;
}

function subtract(left: Vec3, right: Vec3): Vec3 {
  return [left[0] - right[0], left[1] - right[1], left[2] - right[2]];
}

function dot(left: Vec3, right: Vec3): number {
  return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
}

function cross(left: Vec3, right: Vec3): Vec3 {
  return [
    left[1] * right[2] - left[2] * right[1],
    left[2] * right[0] - left[0] * right[2],
    left[0] * right[1] - left[1] * right[0],
  ];
}

function normalize(vector: Vec3): Vec3 {
  const length = Math.hypot(vector[0], vector[1], vector[2]);
  if (length < 0.000_001) return [0, 0, -1];
  return [vector[0] / length, vector[1] / length, vector[2] / length];
}

/** Projects one world-space point through the same authored camera pose used by the template timeline. */
export function projectWorldPoint(
  point: Vec3,
  camera: CameraPose,
  width: number,
  height: number,
): ProjectedPoint {
  const forward = normalize(subtract(camera.target, camera.position));
  const right = normalize(cross(forward, [0, 1, 0]));
  const up = normalize(cross(right, forward));
  const relative = subtract(point, camera.position);
  const depth = dot(relative, forward);
  const focalLength = height / (2 * Math.tan((camera.fov * Math.PI) / 360));
  if (depth <= 0.02) {
    return { x: width / 2, y: height / 2, depth, focalLength, visible: false };
  }
  return {
    x: width / 2 + (dot(relative, right) / depth) * focalLength,
    y: height / 2 - (dot(relative, up) / depth) * focalLength,
    depth,
    focalLength,
    visible: true,
  };
}

export function projectedLength(worldLength: number, point: ProjectedPoint): number {
  if (!point.visible) return 0;
  return Math.max(0, (worldLength / Math.max(0.02, point.depth)) * point.focalLength);
}
