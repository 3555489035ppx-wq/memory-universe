import type { IDBPDatabase } from 'idb';

import type { MementoDB } from './schema';

export function migrateDatabase(database: IDBPDatabase<MementoDB>, oldVersion: number): void {
  if (oldVersion < 1) {
    const memories = database.createObjectStore('memories', { keyPath: 'id' });
    memories.createIndex('by-source', 'source');
    memories.createIndex('by-captured-at', 'capturedAtMs');
    memories.createIndex('by-place', 'placeId');
    memories.createIndex('by-people', 'personIds', { multiEntry: true });
    memories.createIndex('by-mood', 'mood');

    const assets = database.createObjectStore('assets', { keyPath: 'key' });
    assets.createIndex('by-memory', 'memoryId');
    assets.createIndex('by-variant', 'variant');
    assets.createIndex('by-source', 'source');

    const people = database.createObjectStore('people', { keyPath: 'id' });
    people.createIndex('by-source', 'source');
    people.createIndex('by-name', 'name');

    const places = database.createObjectStore('places', { keyPath: 'id' });
    places.createIndex('by-source', 'source');
    places.createIndex('by-name', 'name');

    const constellations = database.createObjectStore('constellations', { keyPath: 'id' });
    constellations.createIndex('by-source', 'source');
    constellations.createIndex('by-updated-at', 'updatedAt');

    database.createObjectStore('settings', { keyPath: 'key' });

    const importJobs = database.createObjectStore('importJobs', { keyPath: 'id' });
    importJobs.createIndex('by-stage', 'stage');
    importJobs.createIndex('by-updated-at', 'updatedAt');

    const layoutCache = database.createObjectStore('layoutCache', { keyPath: 'key' });
    layoutCache.createIndex('by-source', 'source');
  }
}
