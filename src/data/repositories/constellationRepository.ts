import type { Constellation } from '../../domain/constellation';
import type { MemorySource } from '../../domain/memory';
import type { IDBPDatabase } from 'idb';

import { getDatabase } from '../db';
import type { MementoDB } from '../schema';

export async function listConstellations(
  source: MemorySource,
  database?: IDBPDatabase<MementoDB>,
): Promise<Constellation[]> {
  const db = database ?? (await getDatabase());
  return db.getAllFromIndex('constellations', 'by-source', source);
}

export async function getConstellation(
  id: string,
  database?: IDBPDatabase<MementoDB>,
): Promise<Constellation | undefined> {
  const db = database ?? (await getDatabase());
  return db.get('constellations', id);
}

export async function saveConstellation(
  constellation: Constellation,
  database?: IDBPDatabase<MementoDB>,
): Promise<void> {
  if (!constellation.name.trim()) throw new Error('CONSTELLATION_NAME_REQUIRED');
  if (constellation.memoryIds.length < 2) throw new Error('CONSTELLATION_MEMORIES_REQUIRED');
  const db = database ?? (await getDatabase());
  await db.put('constellations', {
    ...constellation,
    name: constellation.name.trim(),
    memoryIds: [...new Set(constellation.memoryIds)].sort(),
  });
}

export async function deleteConstellation(
  id: string,
  database?: IDBPDatabase<MementoDB>,
): Promise<void> {
  const db = database ?? (await getDatabase());
  await db.delete('constellations', id);
}
