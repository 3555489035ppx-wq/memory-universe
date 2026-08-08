import type { IDBPDatabase } from 'idb';

import type { Memory } from '../domain/memory';
import type { MementoDB } from './schema';
import { getDatabase } from './db';

const STALE_IMPORT_JOB_MS = 24 * 60 * 60 * 1000;
const FINISHED_IMPORT_STAGES = new Set(['done', 'failed', 'cancelled']);

export interface MaintenanceReport {
  removedAssets: number;
  removedPeople: number;
  removedPlaces: number;
  removedConstellations: number;
  repairedConstellations: number;
  removedImportJobs: number;
  removedLayoutCaches: number;
  repairedLayoutCaches: number;
}

const emptyReport = (): MaintenanceReport => ({
  removedAssets: 0,
  removedPeople: 0,
  removedPlaces: 0,
  removedConstellations: 0,
  repairedConstellations: 0,
  removedImportJobs: 0,
  removedLayoutCaches: 0,
  repairedLayoutCaches: 0,
});

function isStaleImportJob(updatedAt: string, nowMs: number): boolean {
  const timestamp = Date.parse(updatedAt);
  return !Number.isFinite(timestamp) || nowMs - timestamp > STALE_IMPORT_JOB_MS;
}

function memoryAssetKeys(memory: Memory): Set<string> {
  return new Set(Object.values(memory.assetKeys));
}

/**
 * Repairs recoverable local-storage drift before the first screen is mounted.
 * It is intentionally idempotent: running it repeatedly should not change
 * valid data or invalidate demo assets, which are not stored in IndexedDB.
 */
export async function runStartupMaintenance(
  database?: IDBPDatabase<MementoDB>,
  nowMs = Date.now(),
): Promise<MaintenanceReport> {
  const db = database ?? (await getDatabase());
  const report = emptyReport();
  const transaction = db.transaction(
    ['memories', 'assets', 'people', 'places', 'constellations', 'importJobs', 'layoutCache'],
    'readwrite',
  );

  try {
    const [memories, assets, people, places] = await Promise.all([
      transaction.objectStore('memories').getAll(),
      transaction.objectStore('assets').getAll(),
      transaction.objectStore('people').getAll(),
      transaction.objectStore('places').getAll(),
    ]);
    const memoryById = new Map(memories.map((memory) => [memory.id, memory]));
    const memoryIdsBySource = new Map<'demo' | 'personal', Set<string>>([
      ['demo', new Set()],
      ['personal', new Set()],
    ]);
    const referencedAssetKeys = new Set<string>();
    const referencedPeople = new Set<string>();
    const referencedPlaces = new Set<string>();
    for (const memory of memories) {
      memoryIdsBySource.get(memory.source)?.add(memory.id);
      for (const key of memoryAssetKeys(memory)) referencedAssetKeys.add(key);
      for (const personId of memory.personIds) referencedPeople.add(personId);
      if (memory.placeId) referencedPlaces.add(memory.placeId);
    }

    const assetStore = transaction.objectStore('assets');
    for (const asset of assets) {
      if (asset.source === 'demo') continue;
      const memory = memoryById.get(asset.memoryId);
      if (!memory || memory.source !== asset.source || !referencedAssetKeys.has(asset.key)) {
        await assetStore.delete(asset.key);
        report.removedAssets += 1;
      }
    }

    const peopleStore = transaction.objectStore('people');
    for (const person of people) {
      if (person.source === 'demo') continue;
      if (!referencedPeople.has(person.id)) {
        await peopleStore.delete(person.id);
        report.removedPeople += 1;
      }
    }
    const placesStore = transaction.objectStore('places');
    for (const place of places) {
      if (place.source === 'demo') continue;
      if (!referencedPlaces.has(place.id)) {
        await placesStore.delete(place.id);
        report.removedPlaces += 1;
      }
    }

    const constellationStore = transaction.objectStore('constellations');
    let constellationCursor = await constellationStore.openCursor();
    while (constellationCursor) {
      const constellation = constellationCursor.value;
      // Demo memories are bundled static data and are intentionally not
      // duplicated in IndexedDB, so their stored user-created constellations
      // cannot be validated against memoryById here.
      if (constellation.source === 'demo') {
        constellationCursor = await constellationCursor.continue();
        continue;
      }
      const validMemoryIds = [...new Set(constellation.memoryIds)]
        .filter((id) => memoryById.get(id)?.source === constellation.source)
        .sort((left, right) => left.localeCompare(right));
      if (validMemoryIds.length < 2) {
        await constellationCursor.delete();
        report.removedConstellations += 1;
      } else if (
        validMemoryIds.length !== constellation.memoryIds.length ||
        validMemoryIds.some((id, index) => id !== constellation.memoryIds[index])
      ) {
        await constellationCursor.update({
          ...constellation,
          memoryIds: validMemoryIds,
          updatedAt: new Date(nowMs).toISOString(),
        });
        report.repairedConstellations += 1;
      }
      constellationCursor = await constellationCursor.continue();
    }

    const importJobStore = transaction.objectStore('importJobs');
    let importJobCursor = await importJobStore.openCursor();
    while (importJobCursor) {
      const job = importJobCursor.value;
      if (FINISHED_IMPORT_STAGES.has(job.stage) || isStaleImportJob(job.updatedAt, nowMs)) {
        await importJobCursor.delete();
        report.removedImportJobs += 1;
      }
      importJobCursor = await importJobCursor.continue();
    }

    const layoutStore = transaction.objectStore('layoutCache');
    let layoutCursor = await layoutStore.openCursor();
    while (layoutCursor) {
      const layout = layoutCursor.value;
      if (layout.source === 'demo') {
        layoutCursor = await layoutCursor.continue();
        continue;
      }
      const validIds = memoryIdsBySource.get(layout.source) ?? new Set<string>();
      const positions = Object.fromEntries(
        Object.entries(layout.positions).filter(([id]) => validIds.has(id)),
      );
      const originalCount = Object.keys(layout.positions).length;
      const nextCount = Object.keys(positions).length;
      if (nextCount === 0) {
        await layoutCursor.delete();
        report.removedLayoutCaches += 1;
      } else if (nextCount !== originalCount) {
        await layoutCursor.update({
          ...layout,
          positions,
          updatedAt: new Date(nowMs).toISOString(),
        });
        report.repairedLayoutCaches += 1;
      }
      layoutCursor = await layoutCursor.continue();
    }

    await transaction.done;
    return report;
  } catch (error) {
    try {
      transaction.abort();
    } catch {
      // The transaction may already have aborted.
    }
    throw error;
  }
}
