import type { MemorySource } from '../../domain/memory';
import type { LayoutPositions, UniverseView } from '../../engine/layout/layoutTypes';
import type { IDBPDatabase } from 'idb';

import { getDatabase } from '../db';
import type { MementoDB } from '../schema';

export async function getCachedLayout(
  source: MemorySource,
  view: UniverseView,
  version: number,
  database?: IDBPDatabase<MementoDB>,
): Promise<LayoutPositions | null> {
  const db = database ?? (await getDatabase());
  return (await db.get('layoutCache', [source, view, version]))?.positions ?? null;
}

export async function saveCachedLayout(
  source: MemorySource,
  view: UniverseView,
  version: number,
  positions: LayoutPositions,
  database?: IDBPDatabase<MementoDB>,
): Promise<void> {
  const db = database ?? (await getDatabase());
  await db.put('layoutCache', {
    key: [source, view, version],
    source,
    view,
    version,
    positions,
    updatedAt: new Date().toISOString(),
  });
}
