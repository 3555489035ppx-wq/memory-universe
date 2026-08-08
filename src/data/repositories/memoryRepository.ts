import type { Constellation } from '../../domain/constellation';
import type { Memory, MemorySource } from '../../domain/memory';
import type { Place } from '../../domain/place';
import type { IDBPDatabase } from 'idb';

import { getDatabase } from '../db';
import type { AssetRecord, MementoDB } from '../schema';

async function resolveDatabase(
  database?: IDBPDatabase<MementoDB>,
): Promise<IDBPDatabase<MementoDB>> {
  return database ?? getDatabase();
}

export async function listMemories(
  source: MemorySource,
  database?: IDBPDatabase<MementoDB>,
): Promise<Memory[]> {
  const db = await resolveDatabase(database);
  return db.getAllFromIndex('memories', 'by-source', source);
}

export async function getMemory(
  id: string,
  database?: IDBPDatabase<MementoDB>,
): Promise<Memory | undefined> {
  const db = await resolveDatabase(database);
  return db.get('memories', id);
}

export async function saveMemoryBundle(
  memory: Memory,
  assets: readonly AssetRecord[],
  options: {
    database?: IDBPDatabase<MementoDB>;
    place?: Place;
    signal?: AbortSignal;
  } = {},
): Promise<void> {
  const db = await resolveDatabase(options.database);
  if (assets.some((asset) => asset.memoryId !== memory.id || asset.source !== memory.source)) {
    throw new Error('ASSET_MEMORY_MISMATCH');
  }
  if (
    options.place &&
    (options.place.id !== memory.placeId || options.place.source !== memory.source)
  ) {
    throw new Error('PLACE_MEMORY_MISMATCH');
  }
  if (options.signal?.aborted) throw new DOMException('导入已取消。', 'AbortError');
  const transaction = db.transaction(
    ['memories', 'assets', 'places', 'layoutCache'],
    'readwrite',
  );
  const abortTransaction = () => {
    try {
      transaction.abort();
    } catch {
      // The transaction may have committed between the signal and this handler.
    }
  };
  options.signal?.addEventListener('abort', abortTransaction, { once: true });
  try {
    await transaction.objectStore('memories').put(memory);
    if (options.place) await transaction.objectStore('places').put(options.place);
    for (const asset of assets) {
      await transaction.objectStore('assets').put(asset);
    }
    let cursor = await transaction
      .objectStore('layoutCache')
      .index('by-source')
      .openCursor(memory.source);
    while (cursor) {
      await cursor.delete();
      cursor = await cursor.continue();
    }
    await transaction.done;
  } catch (error) {
    if (options.signal?.aborted) throw new DOMException('导入已取消。', 'AbortError');
    throw error;
  } finally {
    options.signal?.removeEventListener('abort', abortTransaction);
  }
}

export async function updateMemory(
  memory: Memory,
  database?: IDBPDatabase<MementoDB>,
): Promise<void> {
  const db = await resolveDatabase(database);
  const transaction = db.transaction(['memories', 'layoutCache'], 'readwrite');
  await transaction.objectStore('memories').put(memory);
  let cursor = await transaction.objectStore('layoutCache').index('by-source').openCursor(memory.source);
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  await transaction.done;
}

function withoutMemory(constellation: Constellation, memoryId: string): Constellation {
  return {
    ...constellation,
    memoryIds: constellation.memoryIds.filter((id) => id !== memoryId),
    updatedAt: new Date().toISOString(),
  };
}

export async function deleteMemory(
  id: string,
  database?: IDBPDatabase<MementoDB>,
): Promise<boolean> {
  const db = await resolveDatabase(database);
  const memory = await db.get('memories', id);
  if (!memory) return false;

  const transaction = db.transaction(
    ['memories', 'assets', 'constellations', 'layoutCache'],
    'readwrite',
  );
  await transaction.objectStore('memories').delete(id);
  let assetCursor = await transaction.objectStore('assets').index('by-memory').openCursor(id);
  while (assetCursor) {
    await assetCursor.delete();
    assetCursor = await assetCursor.continue();
  }
  let constellationCursor = await transaction
    .objectStore('constellations')
    .index('by-source')
    .openCursor(memory.source);
  while (constellationCursor) {
    if (constellationCursor.value.memoryIds.includes(id)) {
      const updated = withoutMemory(constellationCursor.value, id);
      if (updated.memoryIds.length < 2) await constellationCursor.delete();
      else await constellationCursor.update(updated);
    }
    constellationCursor = await constellationCursor.continue();
  }
  let cacheCursor = await transaction
    .objectStore('layoutCache')
    .index('by-source')
    .openCursor(memory.source);
  while (cacheCursor) {
    await cacheCursor.delete();
    cacheCursor = await cacheCursor.continue();
  }
  await transaction.done;
  return true;
}

export async function getAsset(
  key: string,
  database?: IDBPDatabase<MementoDB>,
): Promise<AssetRecord | undefined> {
  const db = await resolveDatabase(database);
  return db.get('assets', key);
}

export async function listAssets(
  source: MemorySource,
  database?: IDBPDatabase<MementoDB>,
): Promise<AssetRecord[]> {
  const db = await resolveDatabase(database);
  return db.getAllFromIndex('assets', 'by-source', source);
}
