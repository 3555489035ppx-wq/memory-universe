import { createEmotionLayout } from './emotionLayout';
import type { LayoutInput, LayoutPositions, UniverseView } from './layoutTypes';
import { createPeopleLayout } from './peopleLayout';
import { createPlaceLayout } from './placeLayout';
import { createTimeLayout } from './timeLayout';

export function solveLayout(view: UniverseView, input: LayoutInput): LayoutPositions {
  switch (view) {
    case 'time':
      return createTimeLayout(input);
    case 'people':
      return createPeopleLayout(input);
    case 'place':
      return createPlaceLayout(input);
    case 'emotion':
      return createEmotionLayout(input);
  }
}

interface LayoutRequest {
  view: UniverseView;
  input: LayoutInput;
}

interface LayoutWorkerScope {
  postMessage(message: LayoutPositions): void;
  onmessage: ((event: MessageEvent<LayoutRequest>) => void) | null;
}

const workerScope = globalThis as unknown as LayoutWorkerScope;

function isLayoutWorker(): boolean {
  return typeof WorkerGlobalScope !== 'undefined' && globalThis instanceof WorkerGlobalScope;
}

if (isLayoutWorker()) {
  workerScope.onmessage = (event: MessageEvent<LayoutRequest>) => {
    workerScope.postMessage(solveLayout(event.data.view, event.data.input));
  };
}
