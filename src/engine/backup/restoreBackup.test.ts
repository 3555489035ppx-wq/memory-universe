import { strToU8, zipSync } from 'fflate';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { deleteMementoDatabase, getDatabase } from '../../data/db';
import { listAssets, listMemories } from '../../data/repositories/memoryRepository';
import { DEFAULT_SETTINGS } from '../../domain/settings';
import type { BackupManifest } from '../../domain/backup';
import { createMemoryFixture } from '../../test/fixtures/memoryFixture';
import { sha256Hex } from './exportBackup';
import { commitRestore, inspectBackup, type RestoreAsset, type RestorePlan } from './restoreBackup';

const now = '2026-08-04T00:00:00.000Z';

function manifest(): BackupManifest {
  return {
    format: 'memento-backup' as const,
    schemaVersion: 1,
    appVersion: '1.0.0',
    createdAt: now,
    sourceCounts: { memories: 1, people: 0, places: 0, constellations: 0 },
    assetCounts: { micro: 1, thumbnails: 1, previews: 1, originals: 0 },
    includesOriginals: false,
    files: [],
  };
}

function assetsFor(memoryId: string, checksumPrefix = memoryId): RestoreAsset[] {
  return (['micro', 'thumbnail', 'preview'] as const).map((variant) => ({
    key: `source:${memoryId}:${variant}`,
    memoryId,
    source: 'personal' as const,
    variant,
    blob: new Blob([`${checksumPrefix}-${variant}`], { type: 'image/jpeg' }),
    mime: 'image/jpeg',
    width: 12,
    height: 12,
    checksum: variant === 'preview' ? `preview-${checksumPrefix}` : `${variant}-${checksumPrefix}`,
    byteLength: `${checksumPrefix}-${variant}`.length,
    createdAt: now,
    backupPath: `assets/${variant === 'thumbnail' ? 'thumbnails' : `${variant}s`}/${memoryId}-${variant}.jpg`,
  }));
}

function plan(memoryId: string, checksumPrefix = memoryId): RestorePlan {
  const memory = createMemoryFixture({
    id: memoryId,
    source: 'personal',
    assetKeys: {
      micro: `source:${memoryId}:micro`,
      thumbnail: `source:${memoryId}:thumbnail`,
      preview: `source:${memoryId}:preview`,
    },
  });
  return {
    manifest: manifest(),
    memories: [memory],
    assets: assetsFor(memoryId, checksumPrefix),
    people: [],
    places: [],
    constellations: [],
    settings: DEFAULT_SETTINGS,
  };
}

beforeEach(async () => {
  await deleteMementoDatabase();
});

afterEach(async () => {
  await deleteMementoDatabase();
});

describe('backup restore', () => {
  it('skips a duplicate preview checksum even when the incoming memory id differs', async () => {
    const first = await commitRestore(plan('incoming-a', 'same-photo'));
    const second = await commitRestore(plan('incoming-b', 'same-photo'));

    expect(first).toMatchObject({ importedMemories: 1, skippedDuplicates: 0, importedAssets: 3 });
    expect(second).toMatchObject({ importedMemories: 0, skippedDuplicates: 1, importedAssets: 0 });
    expect(await listMemories('personal')).toHaveLength(1);
    expect(await listAssets('personal')).toHaveLength(3);
  });

  it('rejects malformed settings before any restore transaction starts', async () => {
    const payloads: Record<string, Uint8Array<ArrayBuffer>> = {
      'people.json': strToU8('[]'),
      'places.json': strToU8('[]'),
      'constellations.json': strToU8('[]'),
      'settings.json': strToU8('{"quality":"unsafe"}'),
      'metadata.json': strToU8('{"memories":[],"assets":[]}'),
    };
    const baseManifest = manifest();
    baseManifest.files = await Promise.all(
      Object.entries(payloads).map(async ([path, data]) => ({
        path,
        bytes: data.byteLength,
        sha256: await sha256Hex(data),
      })),
    );
    payloads['manifest.json'] = strToU8(JSON.stringify(baseManifest));
    const archive = zipSync(payloads);

    const file = {
      size: archive.byteLength,
      arrayBuffer: () => Promise.resolve(archive.buffer),
    } as File;
    await expect(inspectBackup(file)).rejects.toThrow('BACKUP_SETTINGS_INVALID');
    expect(await getDatabase().then((db) => db.getAll('memories'))).toEqual([]);
  });
});
