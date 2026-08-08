import type { Memory } from '../../domain/memory';
import { normalizeTags } from '../../domain/memory';
import type { Place } from '../../domain/place';
import {
  RELATIONSHIP_ENGINE_VERSION,
  type Relationship,
  type RelationshipContribution,
} from '../../domain/relationship';

const DAY_MS = 86_400_000;

export interface RelationshipContext {
  placesById?: ReadonlyMap<string, Place>;
}

export function tagJaccard(left: readonly string[], right: readonly string[]): number {
  const leftSet = new Set(normalizeTags(left));
  const rightSet = new Set(normalizeTags(right));
  if (leftSet.size === 0 && rightSet.size === 0) return 0;

  let intersection = 0;
  for (const tag of leftSet) {
    if (rightSet.has(tag)) intersection += 1;
  }
  return intersection / (leftSet.size + rightSet.size - intersection);
}

export function distanceInKilometers(
  left: readonly [number, number],
  right: readonly [number, number],
): number {
  const earthRadiusKm = 6_371;
  const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;
  const latitudeDelta = toRadians(right[0] - left[0]);
  const longitudeDelta = toRadians(right[1] - left[1]);
  const leftLatitude = toRadians(left[0]);
  const rightLatitude = toRadians(right[0]);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(leftLatitude) * Math.cos(rightLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function srgbChannelToLinear(channel: number): number {
  const normalized = Math.min(255, Math.max(0, channel)) / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function rgbToOklab(rgb: readonly [number, number, number]): readonly [number, number, number] {
  const red = srgbChannelToLinear(rgb[0]);
  const green = srgbChannelToLinear(rgb[1]);
  const blue = srgbChannelToLinear(rgb[2]);
  const l = 0.412_221_470_8 * red + 0.536_332_536_3 * green + 0.051_445_992_9 * blue;
  const m = 0.211_903_498_2 * red + 0.680_699_545_1 * green + 0.107_396_956_6 * blue;
  const s = 0.088_302_461_9 * red + 0.281_718_837_6 * green + 0.629_978_700_5 * blue;
  const lRoot = Math.cbrt(l);
  const mRoot = Math.cbrt(m);
  const sRoot = Math.cbrt(s);
  return [
    0.210_454_255_3 * lRoot + 0.793_617_785 * mRoot - 0.004_072_046_8 * sRoot,
    1.977_998_495_1 * lRoot - 2.428_592_205 * mRoot + 0.450_593_709_9 * sRoot,
    0.025_904_037_1 * lRoot + 0.782_771_766_2 * mRoot - 0.808_675_766 * sRoot,
  ];
}

export function colorSimilarity(
  leftRgb: readonly [number, number, number],
  rightRgb: readonly [number, number, number],
): number {
  const left = rgbToOklab(leftRgb);
  const right = rgbToOklab(rightRgb);
  const distance = Math.hypot(left[0] - right[0], left[1] - right[1], left[2] - right[2]);
  return Math.max(0, Math.min(1, 1 - distance / 0.45));
}

function sharedPersonLabel(left: Memory, right: Memory): string | null {
  const sharedId = left.personIds.toSorted().find((id) => right.personIds.includes(id));
  return sharedId ? `同一个人 · ${sharedId}` : null;
}

function samePlace(left: Memory, right: Memory, context: RelationshipContext): boolean {
  if (!left.placeId || !right.placeId) return false;
  if (left.placeId === right.placeId) return true;
  const leftPlace = context.placesById?.get(left.placeId);
  const rightPlace = context.placesById?.get(right.placeId);
  if (
    leftPlace?.latitude === undefined ||
    leftPlace.longitude === undefined ||
    rightPlace?.latitude === undefined ||
    rightPlace.longitude === undefined
  ) {
    return false;
  }
  return (
    distanceInKilometers(
      [leftPlace.latitude, leftPlace.longitude],
      [rightPlace.latitude, rightPlace.longitude],
    ) <= 1
  );
}

function roundScore(value: number): number {
  return Math.round(Math.min(1, Math.max(0, value)) * 10_000) / 10_000;
}

export function scoreRelationship(
  first: Memory,
  second: Memory,
  context: RelationshipContext = {},
): Relationship {
  const left = first.id.localeCompare(second.id) <= 0 ? first : second;
  const right = left === first ? second : first;
  const reasons: RelationshipContribution[] = [];
  const personLabel = sharedPersonLabel(left, right);
  if (personLabel) {
    reasons.push({ type: 'shared-person', contribution: 0.35, label: personLabel });
  }

  if (samePlace(left, right, context)) {
    reasons.push({
      type: 'same-place',
      contribution: 0.25,
      label: `同一地点 · ${left.placeId ?? '坐标附近'}`,
    });
  }

  if (left.capturedAtMs !== null && right.capturedAtMs !== null) {
    const difference = Math.abs(left.capturedAtMs - right.capturedAtMs);
    if (difference <= DAY_MS) {
      const hours = Math.max(1, Math.round(difference / 3_600_000));
      reasons.push({
        type: 'within-24h',
        contribution: 0.2,
        label: `相隔 ${String(hours)} 小时`,
      });
    } else if (difference <= DAY_MS * 7) {
      const days = Math.round(difference / DAY_MS);
      reasons.push({
        type: 'within-7d',
        contribution: 0.1,
        label: `相隔 ${String(days)} 天`,
      });
    }
  }

  if (left.mood !== null && left.mood === right.mood) {
    reasons.push({ type: 'same-mood', contribution: 0.1, label: `同一种情绪 · ${left.mood}` });
  }

  const tagScore = tagJaccard(left.tags, right.tags);
  if (tagScore > 0) {
    const commonCount = normalizeTags(left.tags).filter((tag) => normalizeTags(right.tags).includes(tag))
      .length;
    reasons.push({
      type: 'shared-tags',
      contribution: roundScore(tagScore * 0.1),
      label: `${String(commonCount)} 个共同标签`,
    });
  }

  const colorScore = colorSimilarity(left.dominantColor.rgb, right.dominantColor.rgb);
  if (colorScore > 0) {
    reasons.push({
      type: 'similar-color',
      contribution: roundScore(colorScore * 0.1),
      label: '照片色调相近',
    });
  }

  return {
    sourceId: left.id,
    targetId: right.id,
    score: roundScore(reasons.reduce((sum, reason) => sum + reason.contribution, 0)),
    reasons,
    engineVersion: RELATIONSHIP_ENGINE_VERSION,
  };
}
