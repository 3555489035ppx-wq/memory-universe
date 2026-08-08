import type { UniverseLayouts } from '../../stores/sceneStore';
import { createEmotionLayout } from './emotionLayout';
import { createPeopleLayout } from './peopleLayout';
import { createPlaceLayout } from './placeLayout';
import { createTimeLayout } from './timeLayout';
import type { LayoutInput } from './layoutTypes';

export const UNIVERSE_LAYOUT_VERSION = 1;

export function computeUniverseLayouts(input: LayoutInput): UniverseLayouts {
  return {
    time: createTimeLayout(input),
    people: createPeopleLayout(input),
    place: createPlaceLayout(input),
    emotion: createEmotionLayout(input),
  };
}
