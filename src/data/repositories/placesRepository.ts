import type { MemorySource } from '../../domain/memory';
import type { Place } from '../../domain/place';
import type { IDBPDatabase } from 'idb';

import { getDatabase } from '../db';
import type { MementoDB } from '../schema';

export async function listPlaces(
  source: MemorySource,
  database?: IDBPDatabase<MementoDB>,
): Promise<Place[]> {
  const db = database ?? (await getDatabase());
  return db.getAllFromIndex('places', 'by-source', source);
}

export async function savePlace(
  place: Place,
  database?: IDBPDatabase<MementoDB>,
): Promise<void> {
  const db = database ?? (await getDatabase());
  await db.put('places', place);
}

export async function deletePlace(
  id: string,
  database?: IDBPDatabase<MementoDB>,
): Promise<void> {
  const db = database ?? (await getDatabase());
  const transaction = db.transaction(['places', 'memories', 'layoutCache'], 'readwrite');
  const place = await transaction.objectStore('places').get(id);
  if (!place) {
    await transaction.done;
    return;
  }
  await transaction.objectStore('places').delete(id);
  let cursor = await transaction.objectStore('memories').index('by-place').openCursor(id);
  while (cursor) {
    await cursor.update({ ...cursor.value, placeId: null, updatedAt: new Date().toISOString() });
    cursor = await cursor.continue();
  }
  let cacheCursor = await transaction.objectStore('layoutCache').index('by-source').openCursor(place.source);
  while (cacheCursor) {
    await cacheCursor.delete();
    cacheCursor = await cacheCursor.continue();
  }
  await transaction.done;
}
