import { deleteDB, openDB, type IDBPDatabase } from 'idb';

import { migrateDatabase } from './migrations';
import { DATABASE_NAME, DATABASE_VERSION, type MementoDB } from './schema';

let databasePromise: Promise<IDBPDatabase<MementoDB>> | null = null;
let blockedListener: (() => void) | null = null;

export function onDatabaseBlocked(listener: () => void): () => void {
  blockedListener = listener;
  return () => {
    if (blockedListener === listener) blockedListener = null;
  };
}

export function getDatabase(): Promise<IDBPDatabase<MementoDB>> {
  databasePromise ??= openDB<MementoDB>(DATABASE_NAME, DATABASE_VERSION, {
    upgrade(database, oldVersion) {
      migrateDatabase(database, oldVersion);
    },
    blocked() {
      blockedListener?.();
    },
    blocking() {
      void closeDatabase();
    },
    terminated() {
      databasePromise = null;
    },
  });
  return databasePromise;
}

export async function closeDatabase(): Promise<void> {
  if (!databasePromise) return;
  const database = await databasePromise;
  database.close();
  databasePromise = null;
}

export async function deleteMementoDatabase(): Promise<void> {
  await closeDatabase();
  await deleteDB(DATABASE_NAME, {
    blocked() {
      blockedListener?.();
    },
  });
}
