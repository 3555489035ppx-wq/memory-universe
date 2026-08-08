import { DEFAULT_SETTINGS, type Settings } from '../../domain/settings';
import type { IDBPDatabase } from 'idb';

import { getDatabase } from '../db';
import type { MementoDB } from '../schema';

export async function getSettings(database?: IDBPDatabase<MementoDB>): Promise<Settings> {
  const db = database ?? (await getDatabase());
  return (await db.get('settings', 'app-settings'))?.value ?? DEFAULT_SETTINGS;
}

export async function saveSettings(
  settings: Settings,
  database?: IDBPDatabase<MementoDB>,
): Promise<void> {
  const db = database ?? (await getDatabase());
  await db.put('settings', { key: 'app-settings', value: settings });
}
