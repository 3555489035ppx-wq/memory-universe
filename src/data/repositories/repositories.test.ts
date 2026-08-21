import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { Constellation } from '../../domain/constellation';
import { PERSONAL_OPENING_HERO_TAG } from '../../domain/memory';
import type { Person } from '../../domain/person';
import type { Place } from '../../domain/place';
import { createMemoryFixture } from '../../test/fixtures/memoryFixture';
import { deleteMementoDatabase, getDatabase } from '../db';
import type { AssetRecord } from '../schema';
import { saveConstellation } from './constellationRepository';
import { getCachedLayout, saveCachedLayout } from './layoutRepository';
import { deleteMemory, getAsset, getMemory, saveMemoryBundle, updateMemory } from './memoryRepository';
import { deletePerson, savePerson } from './peopleRepository';
import { deletePlace, savePlace } from './placesRepository';

const now = '2026-08-04T00:00:00.000Z';

function createAsset(memoryId: string): AssetRecord {
  return {
    key: `demo:${memoryId}:preview`,
    memoryId,
    source: 'demo',
    variant: 'preview',
    blob: new Blob(['image'], { type: 'image/jpeg' }),
    mime: 'image/jpeg',
    width: 1600,
    height: 1067,
    checksum: 'checksum',
    byteLength: 5,
    createdAt: now,
  };
}

beforeEach(async () => {
  await deleteMementoDatabase();
});

afterEach(async () => {
  await deleteMementoDatabase();
});

describe('IndexedDB repositories', () => {
  it('creates every v1 store and index', async () => {
    const database = await getDatabase();
    expect([...database.objectStoreNames]).toEqual([
      'assets',
      'constellations',
      'importJobs',
      'layoutCache',
      'memories',
      'people',
      'places',
      'settings',
    ]);
    const transaction = database.transaction('memories');
    expect([...transaction.objectStore('memories').indexNames]).toEqual([
      'by-captured-at',
      'by-mood',
      'by-people',
      'by-place',
      'by-source',
    ]);
    await transaction.done;
  });

  it('saves a memory bundle atomically and invalidates its source layout cache', async () => {
    const memory = createMemoryFixture({ id: 'memory-1' });
    await saveCachedLayout('demo', 'time', 1, { stale: [1, 2, 3] });
    await saveCachedLayout('personal', 'time', 1, { retained: [3, 2, 1] });

    await saveMemoryBundle(memory, [createAsset(memory.id)]);

    expect(await getMemory(memory.id)).toEqual(memory);
    expect((await getAsset(`demo:${memory.id}:preview`))?.memoryId).toBe(memory.id);
    expect(await getCachedLayout('demo', 'time', 1)).toBeNull();
    expect(await getCachedLayout('personal', 'time', 1)).toEqual({ retained: [3, 2, 1] });
  });

  it('rejects mismatched assets before writing anything', async () => {
    const memory = createMemoryFixture({ id: 'memory-1' });
    const mismatched = { ...createAsset('other'), key: 'demo:other:preview' };

    await expect(saveMemoryBundle(memory, [mismatched])).rejects.toThrow('ASSET_MEMORY_MISMATCH');
    expect(await getMemory(memory.id)).toBeUndefined();
  });

  it('cascades memory deletion through assets, constellations, and layout cache', async () => {
    const first = createMemoryFixture({ id: 'memory-1' });
    const second = createMemoryFixture({ id: 'memory-2' });
    const constellation: Constellation = {
      id: 'constellation-1',
      source: 'demo',
      name: '海风之后',
      description: '',
      memoryIds: [first.id, second.id],
      createdAt: now,
      updatedAt: now,
    };
    await saveMemoryBundle(first, [createAsset(first.id)]);
    await saveMemoryBundle(second, [createAsset(second.id)]);
    await saveConstellation(constellation);
    await saveCachedLayout('demo', 'people', 1, { cached: [0, 0, 0] });

    await expect(deleteMemory(first.id)).resolves.toBe(true);

    const database = await getDatabase();
    expect(await getMemory(first.id)).toBeUndefined();
    expect(await getAsset(`demo:${first.id}:preview`)).toBeUndefined();
    expect(await database.get('constellations', constellation.id)).toBeUndefined();
    expect(await getCachedLayout('demo', 'people', 1)).toBeNull();
  });

  it('removes deleted people and places from dependent memories', async () => {
    const person: Person = { id: 'person-1', source: 'demo', name: '阿岚', createdAt: now, updatedAt: now };
    const place: Place = { id: 'place-1', source: 'demo', name: '海边', createdAt: now, updatedAt: now };
    const memory = createMemoryFixture({ id: 'memory-1', personIds: [person.id], placeId: place.id });
    await savePerson(person);
    await savePlace(place);
    await saveMemoryBundle(memory, []);

    await deletePerson(person.id);
    await deletePlace(place.id);

    expect((await getMemory(memory.id))?.personIds).toEqual([]);
    expect((await getMemory(memory.id))?.placeId).toBeNull();
  });

  it('keeps exactly one opening hero marker among personal memories', async () => {
    const first = createMemoryFixture({
      id: 'personal-first',
      source: 'personal',
      tags: [PERSONAL_OPENING_HERO_TAG],
    });
    const second = createMemoryFixture({ id: 'personal-second', source: 'personal' });
    await saveMemoryBundle(first, []);
    await saveMemoryBundle(second, []);

    await updateMemory({
      ...second,
      tags: [PERSONAL_OPENING_HERO_TAG],
      updatedAt: '2026-08-12T12:00:00.000Z',
    });

    expect((await getMemory(first.id))?.tags).not.toContain(PERSONAL_OPENING_HERO_TAG);
    expect((await getMemory(second.id))?.tags).toContain(PERSONAL_OPENING_HERO_TAG);
  });
});
