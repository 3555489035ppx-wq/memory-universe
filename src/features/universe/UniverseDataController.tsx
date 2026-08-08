import { useEffect, type ReactNode } from 'react';

import { loadDemoDataset } from '../../data/demoRepository';
import { listConstellations } from '../../data/repositories/constellationRepository';
import { listMemories } from '../../data/repositories/memoryRepository';
import { listPeople } from '../../data/repositories/peopleRepository';
import { listPlaces } from '../../data/repositories/placesRepository';
import type { MemorySource } from '../../domain/memory';
import { computeUniverseLayouts } from '../../engine/layout/computeUniverseLayouts';
import { buildRelationshipGraph } from '../../engine/relationship/buildRelationshipGraph';
import { useSceneStore, type UniverseDataset } from '../../stores/sceneStore';
import { useUiStore } from '../../stores/uiStore';

async function loadDataset(source: MemorySource): Promise<UniverseDataset> {
  if (source === 'demo') {
    const [demo, storedConstellations] = await Promise.all([
      loadDemoDataset(),
      listConstellations('demo'),
    ]);
    const constellations = new Map(
      [...demo.constellations, ...storedConstellations].map((constellation) => [
        constellation.id,
        constellation,
      ]),
    );
    return {
      memories: demo.memories,
      people: demo.people,
      places: demo.places,
      constellations: [...constellations.values()],
    };
  }

  const [memories, people, places, constellations] = await Promise.all([
    listMemories('personal'),
    listPeople('personal'),
    listPlaces('personal'),
    listConstellations('personal'),
  ]);
  return { memories, people, places, constellations };
}

export function UniverseDataController(): ReactNode {
  const source = useSceneStore((state) => state.source);
  const mode = useSceneStore((state) => state.mode);
  const shouldLoad = mode === 'universe' || mode === 'memory' || mode === 'constellation';
  const beginDataLoad = useSceneStore((state) => state.beginDataLoad);
  const setSceneData = useSceneStore((state) => state.setSceneData);
  const setDataError = useSceneStore((state) => state.setDataError);
  const dataRevision = useUiStore((state) => state.dataRevision);

  useEffect(() => {
    if (!shouldLoad) return;
    let cancelled = false;
    beginDataLoad(source);

    void loadDataset(source)
      .then((dataset) => {
        if (cancelled) return;
        const relationships = buildRelationshipGraph(dataset.memories, dataset.places);
        const layouts = computeUniverseLayouts({
          memories: dataset.memories,
          relationships,
          people: dataset.people,
          places: dataset.places,
          viewportSeed: 1_986_121,
        });
        setSceneData(source, dataset, relationships, layouts);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : 'UNKNOWN_DATA_ERROR';
        setDataError(source, message);
      });

    return () => {
      cancelled = true;
    };
  }, [beginDataLoad, dataRevision, setDataError, setSceneData, shouldLoad, source]);

  return null;
}
