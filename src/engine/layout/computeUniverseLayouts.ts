import type { UniverseLayouts } from '../../stores/sceneStore';
import { createEmotionLayout } from './emotionLayout';
import { createPeopleLayout } from './peopleLayout';
import { createPlaceLayout } from './placeLayout';
import { createTimeLayout } from './timeLayout';
import {
  centerLayoutHorizontally,
  centerLayoutVertically,
  type LayoutInput,
  type LayoutPositions,
} from './layoutTypes';

export const UNIVERSE_LAYOUT_VERSION = 2;

function centerLayout(positions: LayoutPositions): LayoutPositions {
  return centerLayoutVertically(centerLayoutHorizontally(positions));
}

export function computeUniverseLayouts(input: LayoutInput): UniverseLayouts {
  return {
    time: centerLayout(createTimeLayout(input)),
    people: centerLayout(createPeopleLayout(input)),
    place: centerLayout(createPlaceLayout(input)),
    emotion: centerLayout(createEmotionLayout(input)),
  };
}
