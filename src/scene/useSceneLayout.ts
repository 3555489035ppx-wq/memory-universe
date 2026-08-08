import { useMemo } from 'react';

import { createConstellationLayout } from '../engine/layout/constellationLayout';
import type { LayoutPositions } from '../engine/layout/layoutTypes';
import { useSceneStore } from '../stores/sceneStore';

export interface ActiveSceneLayout {
  positions: LayoutPositions | null;
  allowedMemoryIds: ReadonlySet<string> | null;
}

export function useSceneLayout(): ActiveSceneLayout {
  const mode = useSceneStore((state) => state.mode);
  const view = useSceneStore((state) => state.view);
  const layouts = useSceneStore((state) => state.layouts);
  const dataset = useSceneStore((state) => state.dataset);
  const relationships = useSceneStore((state) => state.relationships);
  const activeConstellationId = useSceneStore((state) => state.activeConstellationId);

  return useMemo(() => {
    if (!layouts || !dataset) return { positions: null, allowedMemoryIds: null };
    if (mode !== 'constellation' || !activeConstellationId) {
      return { positions: layouts[view], allowedMemoryIds: null };
    }
    const constellation = dataset.constellations.find(
      (candidate) => candidate.id === activeConstellationId,
    );
    if (!constellation) return { positions: {}, allowedMemoryIds: new Set<string>() };
    return {
      positions: createConstellationLayout(
        {
          memories: dataset.memories,
          relationships,
          people: dataset.people,
          places: dataset.places,
          viewportSeed: 1_986_121,
        },
        constellation,
      ),
      allowedMemoryIds: new Set(constellation.memoryIds),
    };
  }, [activeConstellationId, dataset, layouts, mode, relationships, view]);
}
