import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { Constellation } from '../domain/constellation';
import type { Person } from '../domain/person';
import type { Place } from '../domain/place';
import { createMemoryFixture } from '../test/fixtures/memoryFixture';
import { deleteMementoDatabase, getDatabase } from './db';
import { runStartupMaintenance } from './maintenance';
import type { AssetRecord, ImportJobRecord, LayoutCacheRecord } from './schema';

const now = Date.parse('2026-08-04T12:00:00.000Z');

beforeEach(async () => {
  await deleteMementoDatabase();
});

afterEach(async () => {
  await deleteMementoDatabase();
});

describe('startup maintenance', () => {
  it('removes orphaned records and repairs references without touching valid data', async () => {
    const db = await getDatabase();
    const memory = createMemoryFixture({
      id: 'memory-1',
      source: 'personal',
      personIds: ['person-1'],
      placeId: 'place-1',
    });
    const secondMemory = createMemoryFixture({ id: 'memory-2', source: 'personal' });
    const person: Person = {
      id: 'person-1',
      source: 'personal',
      name: 'Valid person',
      createdAt: memory.createdAt,
      updatedAt: memory.updatedAt,
    };
    const place: Place = {
      id: 'place-1',
      source: 'personal',
      name: 'Valid place',
      createdAt: memory.createdAt,
      updatedAt: memory.updatedAt,
    };
    const asset: AssetRecord = {
      key: memory.assetKeys.preview,
      memoryId: memory.id,
      source: 'personal',
      variant: 'preview',
      blob: new Blob(['valid'], { type: 'image/jpeg' }),
      mime: 'image/jpeg',
      width: 1,
      height: 1,
      checksum: 'valid',
      byteLength: 5,
      createdAt: memory.createdAt,
    };
    const orphanAsset = { ...asset, key: 'personal:orphan:preview', memoryId: 'missing' };
    const orphanPerson: Person = { ...person, id: 'person-orphan' };
    const orphanPlace: Place = { ...place, id: 'place-orphan' };
    const constellation: Constellation = {
      id: 'constellation-1',
      source: 'personal',
      name: 'Repaired',
      description: '',
      memoryIds: [memory.id, 'missing-memory', secondMemory.id, memory.id],
      createdAt: memory.createdAt,
      updatedAt: memory.updatedAt,
    };
    const invalidConstellation: Constellation = {
      ...constellation,
      id: 'constellation-invalid',
      memoryIds: ['missing-memory'],
    };
    const demoConstellation: Constellation = {
      ...constellation,
      id: 'demo-user-constellation-static',
      source: 'demo',
      memoryIds: ['demo-memory-001', 'demo-memory-002'],
    };
    const validJob: ImportJobRecord = {
      id: 'job-valid',
      fileName: 'valid.jpg',
      stage: 'parsing',
      progress: 0.5,
      createdAt: new Date(now - 1_000).toISOString(),
      updatedAt: new Date(now - 1_000).toISOString(),
    };
    const staleJob: ImportJobRecord = {
      ...validJob,
      id: 'job-stale',
      updatedAt: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
    };
    const finishedJob: ImportJobRecord = { ...validJob, id: 'job-finished', stage: 'done' };
    const partialLayout: LayoutCacheRecord = {
      key: ['personal', 'time', 1],
      source: 'personal',
      view: 'time',
      version: 1,
      positions: { [memory.id]: [1, 2, 3], missing: [4, 5, 6] },
      updatedAt: memory.updatedAt,
    };
    const emptyLayout: LayoutCacheRecord = {
      key: ['personal', 'emotion', 1],
      source: 'personal',
      view: 'emotion',
      version: 1,
      positions: { missing: [0, 0, 0] },
      updatedAt: memory.updatedAt,
    };

    await db.put('memories', memory);
    await db.put('memories', secondMemory);
    await db.put('assets', asset);
    await db.put('assets', orphanAsset);
    await db.put('people', person);
    await db.put('people', orphanPerson);
    await db.put('places', place);
    await db.put('places', orphanPlace);
    await db.put('constellations', constellation);
    await db.put('constellations', invalidConstellation);
    await db.put('constellations', demoConstellation);
    await db.put('importJobs', validJob);
    await db.put('importJobs', staleJob);
    await db.put('importJobs', finishedJob);
    await db.put('layoutCache', partialLayout);
    await db.put('layoutCache', emptyLayout);

    const report = await runStartupMaintenance(db, now);

    expect(report).toEqual({
      removedAssets: 1,
      removedPeople: 1,
      removedPlaces: 1,
      removedConstellations: 1,
      repairedConstellations: 1,
      removedImportJobs: 2,
      repairedLayoutCaches: 1,
      removedLayoutCaches: 1,
    });
    expect(await db.get('assets', orphanAsset.key)).toBeUndefined();
    expect(await db.get('people', orphanPerson.id)).toBeUndefined();
    expect(await db.get('places', orphanPlace.id)).toBeUndefined();
    expect(await db.get('constellations', invalidConstellation.id)).toBeUndefined();
    expect(await db.get('constellations', demoConstellation.id)).toEqual(demoConstellation);
    expect((await db.get('constellations', constellation.id))?.memoryIds).toEqual([
      memory.id,
      secondMemory.id,
    ]);
    expect(await db.get('importJobs', validJob.id)).toEqual(validJob);
    expect(await db.get('importJobs', staleJob.id)).toBeUndefined();
    expect((await db.get('layoutCache', partialLayout.key))?.positions).toEqual({
      [memory.id]: [1, 2, 3],
    });
    expect(await db.get('layoutCache', emptyLayout.key)).toBeUndefined();
  });
});
