import type { IDBPDatabase } from 'idb';

import { getDatabase } from '../db';
import type { ImportJobRecord, MementoDB } from '../schema';

export async function saveImportJob(
  job: ImportJobRecord,
  database?: IDBPDatabase<MementoDB>,
): Promise<void> {
  const db = database ?? (await getDatabase());
  await db.put('importJobs', job);
}

export async function listImportJobs(
  database?: IDBPDatabase<MementoDB>,
): Promise<ImportJobRecord[]> {
  const db = database ?? (await getDatabase());
  return db.getAll('importJobs');
}

export async function clearFinishedImportJobs(
  database?: IDBPDatabase<MementoDB>,
): Promise<void> {
  const db = database ?? (await getDatabase());
  const transaction = db.transaction('importJobs', 'readwrite');
  let cursor = await transaction.store.openCursor();
  while (cursor) {
    if (['done', 'failed', 'cancelled'].includes(cursor.value.stage)) await cursor.delete();
    cursor = await cursor.continue();
  }
  await transaction.done;
}
