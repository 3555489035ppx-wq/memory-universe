import { unzipSync } from 'fflate';
import { describe, expect, it, vi } from 'vitest';

import { listConstellations } from '../../data/repositories/constellationRepository';
import { listAssets, listMemories } from '../../data/repositories/memoryRepository';
import { listPeople } from '../../data/repositories/peopleRepository';
import { listPlaces } from '../../data/repositories/placesRepository';
import { getSettings } from '../../data/repositories/settingsRepository';
import type { AssetRecord, AssetVariant } from '../../data/schema';
import { DEFAULT_SETTINGS } from '../../domain/settings';
import { createMemoryFixture } from '../../test/fixtures/memoryFixture';
import { exportPersonalBackup, sha256Hex } from './exportBackup';

vi.mock('../../data/repositories/constellationRepository', () => ({ listConstellations: vi.fn() }));
vi.mock('../../data/repositories/memoryRepository', () => ({ listAssets: vi.fn(), listMemories: vi.fn() }));
vi.mock('../../data/repositories/peopleRepository', () => ({ listPeople: vi.fn() }));
vi.mock('../../data/repositories/placesRepository', () => ({ listPlaces: vi.fn() }));
vi.mock('../../data/repositories/settingsRepository', () => ({ getSettings: vi.fn() }));

const now = '2026-08-04T00:00:00.000Z';

async function asset(memoryId: string, variant: AssetVariant): Promise<AssetRecord> {
  const bytes = new TextEncoder().encode(`${memoryId}-${variant}`);
  return {
    key: `personal:${memoryId}:${variant}`,
    memoryId,
    source: 'personal',
    variant,
    blob: new Blob([bytes], { type: 'image/webp' }),
    mime: 'image/webp',
    width: 64,
    height: 64,
    checksum: await sha256Hex(bytes),
    byteLength: bytes.byteLength,
    createdAt: now,
  };
}

describe('personal backup export', () => {
  it('streams a manifest, metadata, and pass-through image variants into a valid ZIP', async () => {
    const memory = createMemoryFixture({ id: 'personal-memory-a', source: 'personal' });
    vi.mocked(listMemories).mockResolvedValue([memory]);
    vi.mocked(listAssets).mockResolvedValue(await Promise.all([
      asset(memory.id, 'micro'),
      asset(memory.id, 'thumbnail'),
      asset(memory.id, 'preview'),
    ]));
    vi.mocked(listPeople).mockResolvedValue([]);
    vi.mocked(listPlaces).mockResolvedValue([]);
    vi.mocked(listConstellations).mockResolvedValue([]);
    vi.mocked(getSettings).mockResolvedValue(DEFAULT_SETTINGS);

    const { blob, manifest } = await exportPersonalBackup({ includeOriginals: false });
    const archiveBytes = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => reader.result instanceof ArrayBuffer ? resolve(reader.result) : reject(new Error('read failed'));
      reader.onerror = () => reject(reader.error ?? new Error('read failed'));
      reader.readAsArrayBuffer(blob);
    });
    const files = unzipSync(new Uint8Array(archiveBytes));

    expect(manifest.sourceCounts.memories).toBe(1);
    expect(manifest.assetCounts).toMatchObject({ micro: 1, thumbnails: 1, previews: 1, originals: 0 });
    expect(Object.keys(files)).toEqual(expect.arrayContaining([
      'manifest.json',
      'metadata.json',
      'people.json',
      'places.json',
      'constellations.json',
      'settings.json',
    ]));
    expect(Object.keys(files).filter((path) => path.startsWith('assets/'))).toHaveLength(3);
  });

  it('honors a pre-cancelled export without producing a file', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      exportPersonalBackup({ includeOriginals: false, signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});
