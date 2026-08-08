import type { IDBPDatabase } from 'idb';

import { getDatabase } from '../db';
import type { MementoDB } from '../schema';

export async function clearPersonalData(database?: IDBPDatabase<MementoDB>): Promise<void> {
  const db = database ?? (await getDatabase());
  const transaction = db.transaction(
    ['memories', 'assets', 'people', 'places', 'constellations', 'layoutCache', 'importJobs'],
    'readwrite',
  );

  let memoryCursor = await transaction.objectStore('memories').index('by-source').openCursor('personal');
  while (memoryCursor) {
    await memoryCursor.delete();
    memoryCursor = await memoryCursor.continue();
  }
  let assetCursor = await transaction.objectStore('assets').index('by-source').openCursor('personal');
  while (assetCursor) {
    await assetCursor.delete();
    assetCursor = await assetCursor.continue();
  }
  let peopleCursor = await transaction.objectStore('people').index('by-source').openCursor('personal');
  while (peopleCursor) {
    await peopleCursor.delete();
    peopleCursor = await peopleCursor.continue();
  }
  let placesCursor = await transaction.objectStore('places').index('by-source').openCursor('personal');
  while (placesCursor) {
    await placesCursor.delete();
    placesCursor = await placesCursor.continue();
  }
  let constellationCursor = await transaction.objectStore('constellations').index('by-source').openCursor('personal');
  while (constellationCursor) {
    await constellationCursor.delete();
    constellationCursor = await constellationCursor.continue();
  }
  let layoutCursor = await transaction.objectStore('layoutCache').index('by-source').openCursor('personal');
  while (layoutCursor) {
    await layoutCursor.delete();
    layoutCursor = await layoutCursor.continue();
  }
  await transaction.objectStore('importJobs').clear();
  await transaction.done;
}
