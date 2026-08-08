import type { MemorySource } from '../../domain/memory';
import type { Person } from '../../domain/person';
import type { IDBPDatabase } from 'idb';

import { getDatabase } from '../db';
import type { MementoDB } from '../schema';

export async function listPeople(
  source: MemorySource,
  database?: IDBPDatabase<MementoDB>,
): Promise<Person[]> {
  const db = database ?? (await getDatabase());
  return db.getAllFromIndex('people', 'by-source', source);
}

export async function savePerson(
  person: Person,
  database?: IDBPDatabase<MementoDB>,
): Promise<void> {
  const db = database ?? (await getDatabase());
  await db.put('people', person);
}

export async function deletePerson(
  id: string,
  database?: IDBPDatabase<MementoDB>,
): Promise<void> {
  const db = database ?? (await getDatabase());
  const transaction = db.transaction(['people', 'memories', 'layoutCache'], 'readwrite');
  const person = await transaction.objectStore('people').get(id);
  if (!person) {
    await transaction.done;
    return;
  }
  await transaction.objectStore('people').delete(id);
  let cursor = await transaction.objectStore('memories').index('by-people').openCursor(id);
  while (cursor) {
    await cursor.update({
      ...cursor.value,
      personIds: cursor.value.personIds.filter((personId) => personId !== id),
      updatedAt: new Date().toISOString(),
    });
    cursor = await cursor.continue();
  }
  let cacheCursor = await transaction.objectStore('layoutCache').index('by-source').openCursor(person.source);
  while (cacheCursor) {
    await cacheCursor.delete();
    cacheCursor = await cacheCursor.continue();
  }
  await transaction.done;
}
