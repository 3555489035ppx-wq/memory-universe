import type { Constellation } from '../domain/constellation';
import type { Memory } from '../domain/memory';
import type { Person } from '../domain/person';
import type { Place } from '../domain/place';
import type { IDBPDatabase } from 'idb';

import { getDatabase } from './db';
import type { MementoDB } from './schema';

export interface DemoDataset {
  schemaVersion: number;
  memories: Memory[];
  people: Person[];
  places: Place[];
  constellations: Constellation[];
}

export async function loadDemoDataset(fetcher: typeof fetch = fetch): Promise<DemoDataset> {
  const basePath = import.meta.env.BASE_URL.replace(/\/$/u, '');
  const response = await fetcher(`${basePath}/demo/demo-memories.json`);
  if (!response.ok) throw new Error('DEMO_DATA_UNAVAILABLE');
  const dataset = (await response.json()) as DemoDataset;
  if (dataset.schemaVersion !== 1 || dataset.memories.length < 96) {
    throw new Error('DEMO_DATA_INVALID');
  }
  const withBasePath = (assetPath: string): string =>
    assetPath.startsWith('/') ? `${basePath}${assetPath}` : assetPath;
  return {
    ...dataset,
    memories: dataset.memories.map((memory) => ({
      ...memory,
      assetKeys: {
        micro: withBasePath(memory.assetKeys.micro),
        thumbnail: withBasePath(memory.assetKeys.thumbnail),
        preview: withBasePath(memory.assetKeys.preview),
      },
    })),
  };
}

export async function ensureDemoSeeded(
  dataset: DemoDataset,
  database?: IDBPDatabase<MementoDB>,
): Promise<void> {
  const db = database ?? (await getDatabase());
  const transaction = db.transaction(
    ['memories', 'people', 'places', 'constellations'],
    'readwrite',
  );
  const memoriesStore = transaction.objectStore('memories');
  const peopleStore = transaction.objectStore('people');
  const placesStore = transaction.objectStore('places');
  const constellationsStore = transaction.objectStore('constellations');

  for (const memory of dataset.memories) {
    if (!(await memoriesStore.getKey(memory.id))) await memoriesStore.add(memory);
  }
  for (const person of dataset.people) {
    if (!(await peopleStore.getKey(person.id))) await peopleStore.add(person);
  }
  for (const place of dataset.places) {
    if (!(await placesStore.getKey(place.id))) await placesStore.add(place);
  }
  for (const constellation of dataset.constellations) {
    if (!(await constellationsStore.getKey(constellation.id))) {
      await constellationsStore.add(constellation);
    }
  }
  await transaction.done;
}
