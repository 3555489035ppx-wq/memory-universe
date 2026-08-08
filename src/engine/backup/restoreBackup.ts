import { strFromU8, unzip } from 'fflate';

import { getDatabase } from '../../data/db';
import type { AssetRecord } from '../../data/schema';
import type { BackupManifest } from '../../domain/backup';
import type { Constellation } from '../../domain/constellation';
import { isMemorySource, type Memory, type Mood } from '../../domain/memory';
import type { Person } from '../../domain/person';
import type { Place } from '../../domain/place';
import type { Settings } from '../../domain/settings';
import { BACKUP_LIMITS, validateBackupPath } from './backupLimits';
import { sha256Hex, type BackupProgress } from './exportBackup';

interface BackupAssetMetadata extends Omit<AssetRecord, 'blob'> {
  backupPath: string;
}

interface BackupMetadata {
  memories: Memory[];
  assets: BackupAssetMetadata[];
}

const DATE_SOURCES = new Set(['exif', 'file', 'manual', 'unknown']);
const MOODS = new Set<Mood>(['happy', 'calm', 'nostalgic', 'excited', 'chaotic', 'lonely', null]);
const ASSET_VARIANTS = new Set<AssetRecord['variant']>([
  'micro',
  'thumbnail',
  'preview',
  'original',
]);
const QUALITIES = new Set(['auto', 'high', 'medium', 'low']);
const MOTIONS = new Set(['full', 'reduced']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isMemoryRecord(value: unknown): value is Memory {
  if (!isRecord(value)) return false;
  const dominantColor = value.dominantColor;
  const assetKeys = value.assetKeys;
  return (
    isString(value.id) &&
    isMemorySource(String(value.source)) &&
    value.source === 'personal' &&
    isString(value.title) &&
    typeof value.description === 'string' &&
    (value.capturedAt === null || typeof value.capturedAt === 'string') &&
    (value.capturedAtMs === null || isFiniteNumber(value.capturedAtMs)) &&
    typeof value.dateSource === 'string' &&
    DATE_SOURCES.has(value.dateSource) &&
    isStringArray(value.personIds) &&
    (value.placeId === null || typeof value.placeId === 'string') &&
    (value.mood === null || typeof value.mood === 'string') &&
    MOODS.has(value.mood as Mood) &&
    isStringArray(value.tags) &&
    isRecord(dominantColor) &&
    Array.isArray(dominantColor.rgb) &&
    dominantColor.rgb.length === 3 &&
    dominantColor.rgb.every(isFiniteNumber) &&
    Array.isArray(dominantColor.hsl) &&
    dominantColor.hsl.length === 3 &&
    dominantColor.hsl.every(isFiniteNumber) &&
    isFiniteNumber(dominantColor.luminance) &&
    Number.isInteger(dominantColor.algorithmVersion) &&
    isRecord(assetKeys) &&
    isString(assetKeys.micro) &&
    isString(assetKeys.thumbnail) &&
    isString(assetKeys.preview) &&
    (assetKeys.original === undefined || isString(assetKeys.original)) &&
    isFiniteNumber(value.width) &&
    value.width > 0 &&
    isFiniteNumber(value.height) &&
    value.height > 0 &&
    typeof value.orientationApplied === 'boolean' &&
    (value.cameraModel === undefined || typeof value.cameraModel === 'string') &&
    isString(value.createdAt) &&
    isString(value.updatedAt) &&
    value.schemaVersion === 1
  );
}

function isPersonRecord(value: unknown): value is Person {
  return (
    isRecord(value) &&
    isString(value.id) &&
    value.source === 'personal' &&
    isString(value.name) &&
    isString(value.createdAt) &&
    isString(value.updatedAt)
  );
}

function isPlaceRecord(value: unknown): value is Place {
  return (
    isRecord(value) &&
    isString(value.id) &&
    value.source === 'personal' &&
    isString(value.name) &&
    (value.latitude === undefined || isFiniteNumber(value.latitude)) &&
    (value.longitude === undefined || isFiniteNumber(value.longitude)) &&
    isString(value.createdAt) &&
    isString(value.updatedAt)
  );
}

function isConstellationRecord(value: unknown): value is Constellation {
  return (
    isRecord(value) &&
    isString(value.id) &&
    value.source === 'personal' &&
    isString(value.name) &&
    typeof value.description === 'string' &&
    isStringArray(value.memoryIds) &&
    value.memoryIds.length >= 2 &&
    isString(value.createdAt) &&
    isString(value.updatedAt)
  );
}

function isSettingsRecord(value: unknown): value is Settings {
  return (
    isRecord(value) &&
    typeof value.quality === 'string' &&
    QUALITIES.has(value.quality) &&
    typeof value.motion === 'string' &&
    MOTIONS.has(value.motion) &&
    typeof value.includeOriginalsInBackup === 'boolean' &&
    (value.lastUniverseMode === 'demo' || value.lastUniverseMode === 'personal') &&
    value.schemaVersion === 1
  );
}

function isBackupAssetMetadata(value: unknown): value is BackupAssetMetadata {
  if (!isRecord(value)) return false;
  const variant = value.variant;
  return (
    isString(value.key) &&
    isString(value.memoryId) &&
    value.source === 'personal' &&
    (variant === 'micro' ||
      variant === 'thumbnail' ||
      variant === 'preview' ||
      variant === 'original') &&
    isString(value.mime) &&
    isFiniteNumber(value.width) &&
    isFiniteNumber(value.height) &&
    value.width > 0 &&
    value.height > 0 &&
    isString(value.checksum) &&
    typeof value.byteLength === 'number' &&
    Number.isInteger(value.byteLength) &&
    value.byteLength >= 0 &&
    isString(value.createdAt) &&
    isString(value.backupPath)
  );
}

function assertArrayOf<T>(
  value: unknown,
  guard: (item: unknown) => item is T,
  code: string,
): asserts value is T[] {
  if (!Array.isArray(value) || !value.every(guard)) throw new Error(code);
}

function assertUniqueIds(items: readonly { id: string }[], code: string): void {
  const ids = new Set(items.map((item) => item.id));
  if (ids.size !== items.length) throw new Error(code);
}

export interface RestoreAsset extends AssetRecord {
  backupPath: string;
}

export interface RestorePlan {
  manifest: BackupManifest;
  memories: Memory[];
  assets: RestoreAsset[];
  people: Person[];
  places: Place[];
  constellations: Constellation[];
  settings: Settings;
}

export interface RestoreSummary {
  importedMemories: number;
  skippedDuplicates: number;
  importedAssets: number;
  importedConstellations: number;
}

function asBytes(value: Uint8Array): Uint8Array<ArrayBuffer> {
  return new Uint8Array(value);
}

function unzipArchive(
  bytes: Uint8Array<ArrayBuffer>,
): Promise<Record<string, Uint8Array<ArrayBuffer>>> {
  return new Promise((resolve, reject) => {
    let entryCount = 0;
    let expandedBytes = 0;
    let policyError: Error | null = null;
    try {
      unzip(
        bytes,
        {
          filter: (entry) => {
            if (policyError) return false;
            try {
              validateBackupPath(entry.name);
              entryCount += 1;
              expandedBytes += entry.originalSize;
              if (entryCount > BACKUP_LIMITS.maxEntries) throw new Error('BACKUP_TOO_MANY_ENTRIES');
              if (entry.originalSize > BACKUP_LIMITS.maxEntryBytes)
                throw new Error('BACKUP_ENTRY_TOO_LARGE');
              if (expandedBytes > BACKUP_LIMITS.maxExpandedBytes)
                throw new Error('BACKUP_EXPANDED_TOO_LARGE');
              return true;
            } catch (error) {
              policyError = error instanceof Error ? error : new Error('BACKUP_POLICY_FAILED');
              return false;
            }
          },
        },
        (error, data) => {
          if (policyError) {
            reject(policyError);
            return;
          }
          if (error) {
            reject(error);
            return;
          }
          resolve(
            Object.fromEntries(Object.entries(data).map(([path, value]) => [path, asBytes(value)])),
          );
        },
      );
    } catch (error) {
      reject(error instanceof Error ? error : new Error('BACKUP_UNZIP_FAILED'));
    }
  });
}

function parseJson(files: Record<string, Uint8Array<ArrayBuffer>>, path: string): unknown {
  const data = files[path];
  if (!data) throw new Error(`BACKUP_REQUIRED_FILE_MISSING:${path}`);
  try {
    return JSON.parse(strFromU8(data)) as unknown;
  } catch {
    throw new Error(`BACKUP_JSON_INVALID:${path}`);
  }
}

function validateManifest(value: unknown): asserts value is BackupManifest {
  if (!value || typeof value !== 'object') throw new Error('BACKUP_MANIFEST_UNSUPPORTED');
  const candidate = value as Partial<BackupManifest>;
  if (
    candidate.format !== 'memento-backup' ||
    candidate.schemaVersion !== 1 ||
    candidate.appVersion !== '1.0.0' ||
    !isString(candidate.createdAt) ||
    !Array.isArray(candidate.files) ||
    !isRecord(candidate.sourceCounts) ||
    !isRecord(candidate.assetCounts) ||
    typeof candidate.includesOriginals !== 'boolean'
  ) {
    throw new Error('BACKUP_MANIFEST_UNSUPPORTED');
  }
  const sourceCounts = candidate.sourceCounts;
  const assetCounts = candidate.assetCounts;
  if (
    ![
      sourceCounts.memories,
      sourceCounts.people,
      sourceCounts.places,
      sourceCounts.constellations,
    ].every((count) => typeof count === 'number' && Number.isInteger(count) && count >= 0) ||
    ![assetCounts.micro, assetCounts.thumbnails, assetCounts.previews, assetCounts.originals].every(
      (count) => typeof count === 'number' && Number.isInteger(count) && count >= 0,
    )
  ) {
    throw new Error('BACKUP_MANIFEST_UNSUPPORTED');
  }
  const seenPaths = new Set<string>();
  for (const entry of candidate.files) {
    if (
      !isRecord(entry) ||
      !isString(entry.path) ||
      !Number.isInteger(entry.bytes) ||
      entry.bytes < 0 ||
      typeof entry.sha256 !== 'string' ||
      !/^[a-f0-9]{64}$/iu.test(entry.sha256) ||
      seenPaths.has(entry.path)
    ) {
      throw new Error('BACKUP_MANIFEST_UNSUPPORTED');
    }
    seenPaths.add(entry.path);
  }
}

function validateStaging(plan: Omit<RestorePlan, 'assets'>, assets: RestoreAsset[]): void {
  if (plan.memories.some((memory) => !isMemoryRecord(memory)))
    throw new Error('BACKUP_MEMORY_INVALID');
  if (plan.people.some((person) => !isPersonRecord(person)))
    throw new Error('BACKUP_PERSON_INVALID');
  if (plan.places.some((place) => !isPlaceRecord(place))) throw new Error('BACKUP_PLACE_INVALID');
  if (plan.constellations.some((item) => !isConstellationRecord(item))) {
    throw new Error('BACKUP_CONSTELLATION_INVALID');
  }
  if (!isSettingsRecord(plan.settings)) throw new Error('BACKUP_SETTINGS_INVALID');
  assertUniqueIds(plan.memories, 'BACKUP_MEMORY_DUPLICATE');
  assertUniqueIds(plan.people, 'BACKUP_PERSON_DUPLICATE');
  assertUniqueIds(plan.places, 'BACKUP_PLACE_DUPLICATE');
  assertUniqueIds(plan.constellations, 'BACKUP_CONSTELLATION_DUPLICATE');

  const memoryIds = new Set(plan.memories.map((memory) => memory.id));
  const personIds = new Set(plan.people.map((person) => person.id));
  const placeIds = new Set(plan.places.map((place) => place.id));
  const assetKeys = new Set<string>();
  const backupPaths = new Set<string>();
  const assetVariants = new Map<string, Set<AssetRecord['variant']>>();
  for (const memory of plan.memories) {
    if (memory.personIds.some((id) => !personIds.has(id)))
      throw new Error('BACKUP_MEMORY_PERSON_MISSING');
    if (memory.placeId && !placeIds.has(memory.placeId))
      throw new Error('BACKUP_MEMORY_PLACE_MISSING');
    for (const key of Object.values(memory.assetKeys)) {
      if (!isString(key)) throw new Error('BACKUP_MEMORY_ASSET_MISSING');
    }
  }
  for (const asset of assets) {
    if (
      asset.source !== 'personal' ||
      !isString(asset.memoryId) ||
      !ASSET_VARIANTS.has(asset.variant) ||
      !isString(asset.key) ||
      !isString(asset.mime) ||
      !isFiniteNumber(asset.width) ||
      !isFiniteNumber(asset.height) ||
      asset.width <= 0 ||
      asset.height <= 0 ||
      !isString(asset.checksum) ||
      !Number.isInteger(asset.byteLength) ||
      asset.byteLength < 0 ||
      !isString(asset.createdAt) ||
      !isString(asset.backupPath) ||
      assetKeys.has(asset.key) ||
      backupPaths.has(asset.backupPath)
    ) {
      throw new Error('BACKUP_ASSET_INVALID');
    }
    if (!memoryIds.has(asset.memoryId)) throw new Error('BACKUP_ASSET_MEMORY_MISSING');
    assetKeys.add(asset.key);
    backupPaths.add(asset.backupPath);
    const variants = assetVariants.get(asset.memoryId) ?? new Set<AssetRecord['variant']>();
    variants.add(asset.variant);
    assetVariants.set(asset.memoryId, variants);
  }
  for (const memory of plan.memories) {
    const variants = assetVariants.get(memory.id) ?? new Set<AssetRecord['variant']>();
    if (!variants.has('micro') || !variants.has('thumbnail') || !variants.has('preview')) {
      throw new Error('BACKUP_VARIANT_MISSING');
    }
    for (const [variant, key] of Object.entries(memory.assetKeys)) {
      const asset = assets.find((candidate) => candidate.key === key);
      if (!asset || asset.memoryId !== memory.id || asset.variant !== variant) {
        throw new Error('BACKUP_MEMORY_ASSET_MISMATCH');
      }
    }
  }
  if (plan.constellations.some((item) => item.memoryIds.some((id) => !memoryIds.has(id)))) {
    throw new Error('BACKUP_CONSTELLATION_MEMORY_MISSING');
  }
}

export async function inspectBackup(
  file: File,
  onProgress?: (progress: BackupProgress) => void,
): Promise<RestorePlan> {
  if (file.size > BACKUP_LIMITS.maxZipBytes) throw new Error('BACKUP_ZIP_TOO_LARGE');
  onProgress?.({ completed: 0, total: 1, stage: 'collecting', label: '读取备份目录' });
  const files = await unzipArchive(new Uint8Array(await file.arrayBuffer()));
  const manifestValue = parseJson(files, 'manifest.json');
  validateManifest(manifestValue);
  const manifest = manifestValue;

  const archivePaths = new Set(Object.keys(files).filter((path) => path !== 'manifest.json'));
  if (manifest.files.length !== archivePaths.size) throw new Error('BACKUP_FILE_LIST_MISMATCH');
  for (let index = 0; index < manifest.files.length; index += 1) {
    const entry = manifest.files[index];
    if (!entry) continue;
    validateBackupPath(entry.path);
    const data = files[entry.path];
    if (!data || data.byteLength !== entry.bytes || !archivePaths.has(entry.path)) {
      throw new Error(`BACKUP_FILE_MISMATCH:${entry.path}`);
    }
    const checksum = await sha256Hex(data);
    if (checksum !== entry.sha256) throw new Error(`BACKUP_CHECKSUM_MISMATCH:${entry.path}`);
    onProgress?.({
      completed: index + 1,
      total: manifest.files.length,
      stage: 'hashing',
      label: entry.path,
    });
  }

  const metadataValue = parseJson(files, 'metadata.json');
  const peopleValue = parseJson(files, 'people.json');
  const placesValue = parseJson(files, 'places.json');
  const constellationsValue = parseJson(files, 'constellations.json');
  const settingsValue = parseJson(files, 'settings.json');
  if (
    !isRecord(metadataValue) ||
    !Array.isArray(metadataValue.memories) ||
    !Array.isArray(metadataValue.assets) ||
    !Array.isArray(peopleValue) ||
    !Array.isArray(placesValue) ||
    !Array.isArray(constellationsValue)
  ) {
    throw new Error('BACKUP_METADATA_INVALID');
  }
  assertArrayOf(metadataValue.memories, isMemoryRecord, 'BACKUP_MEMORY_INVALID');
  assertArrayOf(metadataValue.assets, isBackupAssetMetadata, 'BACKUP_ASSET_INVALID');
  assertArrayOf(peopleValue, isPersonRecord, 'BACKUP_PERSON_INVALID');
  assertArrayOf(placesValue, isPlaceRecord, 'BACKUP_PLACE_INVALID');
  assertArrayOf(constellationsValue, isConstellationRecord, 'BACKUP_CONSTELLATION_INVALID');
  if (!isSettingsRecord(settingsValue)) throw new Error('BACKUP_SETTINGS_INVALID');
  const metadata: BackupMetadata = {
    memories: metadataValue.memories,
    assets: metadataValue.assets,
  };
  const people = peopleValue;
  const places = placesValue;
  const constellations = constellationsValue;
  const settings = settingsValue;
  const manifestHashes = new Map(manifest.files.map((entry) => [entry.path, entry.sha256]));
  const assets = metadata.assets.map((assetValue): RestoreAsset => {
    if (
      !isRecord(assetValue) ||
      !isString(assetValue.key) ||
      !isString(assetValue.memoryId) ||
      assetValue.source !== 'personal' ||
      typeof assetValue.variant !== 'string' ||
      !ASSET_VARIANTS.has(assetValue.variant) ||
      !isString(assetValue.mime) ||
      !isFiniteNumber(assetValue.width) ||
      !isFiniteNumber(assetValue.height) ||
      !isString(assetValue.checksum) ||
      !Number.isInteger(assetValue.byteLength) ||
      assetValue.byteLength < 0 ||
      !isString(assetValue.createdAt) ||
      !isString(assetValue.backupPath)
    ) {
      throw new Error('BACKUP_ASSET_INVALID');
    }
    const variant = assetValue.variant;
    validateBackupPath(assetValue.backupPath);
    const data = files[assetValue.backupPath];
    if (!data) throw new Error(`BACKUP_ASSET_MISSING:${assetValue.backupPath}`);
    if (assetValue.byteLength !== data.byteLength) {
      throw new Error(`BACKUP_ASSET_SIZE_MISMATCH:${assetValue.backupPath}`);
    }
    return {
      key: assetValue.key,
      memoryId: assetValue.memoryId,
      source: 'personal',
      variant,
      blob: new Blob([data], { type: assetValue.mime }),
      mime: assetValue.mime,
      width: assetValue.width,
      height: assetValue.height,
      checksum: manifestHashes.get(assetValue.backupPath) ?? assetValue.checksum,
      byteLength: data.byteLength,
      createdAt: assetValue.createdAt,
      backupPath: assetValue.backupPath,
    };
  });
  const staging = {
    manifest,
    memories: metadata.memories,
    people,
    places,
    constellations,
    settings,
  };
  validateStaging(staging, assets);
  return { ...staging, assets };
}

function remappedAssetKey(memoryId: string, variant: AssetRecord['variant']): string {
  return `personal:${memoryId}:${variant}`;
}

function constellationSignature(
  name: string,
  description: string,
  memoryIds: readonly string[],
): string {
  return JSON.stringify([name.trim(), description.trim(), [...new Set(memoryIds)].sort()]);
}

export async function commitRestore(plan: RestorePlan): Promise<RestoreSummary> {
  const db = await getDatabase();
  const transaction = db.transaction(
    ['memories', 'assets', 'people', 'places', 'constellations', 'settings', 'layoutCache'],
    'readwrite',
  );
  const memoryStore = transaction.objectStore('memories');
  const assetStore = transaction.objectStore('assets');
  const peopleStore = transaction.objectStore('people');
  const placesStore = transaction.objectStore('places');
  const constellationStore = transaction.objectStore('constellations');
  const personMap = new Map<string, string>();
  const placeMap = new Map<string, string>();
  const memoryMap = new Map<string, string>();
  const skippedMemoryIds = new Set<string>();
  const existingPreviewChecksums = new Map<string, string>();
  const existingConstellationSignatures = new Set<string>();
  let importedAssets = 0;

  try {
    for (const person of plan.people) {
      const existing = await peopleStore.get(person.id);
      if (!existing || existing.name === person.name) {
        personMap.set(person.id, person.id);
        if (!existing) await peopleStore.put(person);
      } else {
        const id = `personal-person-${crypto.randomUUID()}`;
        personMap.set(person.id, id);
        await peopleStore.put({ ...person, id });
      }
    }
    for (const place of plan.places) {
      const existing = await placesStore.get(place.id);
      if (!existing || existing.name === place.name) {
        placeMap.set(place.id, place.id);
        if (!existing) await placesStore.put(place);
      } else {
        const id = `personal-place-${crypto.randomUUID()}`;
        placeMap.set(place.id, id);
        await placesStore.put({ ...place, id });
      }
    }

    const assetsByMemory = new Map<string, RestoreAsset[]>();
    for (const asset of plan.assets) {
      const group = assetsByMemory.get(asset.memoryId) ?? [];
      group.push(asset);
      assetsByMemory.set(asset.memoryId, group);
    }
    const existingPersonalMemories = await memoryStore.index('by-source').getAll('personal');
    for (const existingMemory of existingPersonalMemories) {
      const existingPreview = await assetStore.get(existingMemory.assetKeys.preview);
      if (existingPreview?.checksum) {
        existingPreviewChecksums.set(existingPreview.checksum, existingMemory.id);
      }
    }
    for (const memory of plan.memories) {
      const incomingAssets = assetsByMemory.get(memory.id) ?? [];
      const incomingPreview = incomingAssets.find((asset) => asset.variant === 'preview');
      if (!incomingPreview) throw new Error('BACKUP_PREVIEW_MISSING');
      const duplicateId = existingPreviewChecksums.get(incomingPreview.checksum);
      if (duplicateId) {
        memoryMap.set(memory.id, duplicateId);
        skippedMemoryIds.add(memory.id);
        continue;
      }
      const existing = await memoryStore.get(memory.id);
      let finalId = memory.id;
      if (existing) {
        const existingPreview = await assetStore.get(existing.assetKeys.preview);
        if (existingPreview?.checksum === incomingPreview.checksum) {
          memoryMap.set(memory.id, memory.id);
          skippedMemoryIds.add(memory.id);
          continue;
        }
        finalId = `personal-memory-${crypto.randomUUID()}`;
      }
      memoryMap.set(memory.id, finalId);
      const remappedAssets = incomingAssets.map((asset): AssetRecord => ({
        key: remappedAssetKey(finalId, asset.variant),
        memoryId: finalId,
        source: 'personal',
        variant: asset.variant,
        blob: asset.blob,
        mime: asset.mime,
        width: asset.width,
        height: asset.height,
        checksum: asset.checksum,
        byteLength: asset.byteLength,
        createdAt: asset.createdAt,
      }));
      for (const asset of remappedAssets) {
        await assetStore.put(asset);
        importedAssets += 1;
      }
      existingPreviewChecksums.set(incomingPreview.checksum, finalId);
      const keyFor = (variant: 'micro' | 'thumbnail' | 'preview'): string => {
        const asset = remappedAssets.find((candidate) => candidate.variant === variant);
        if (!asset) throw new Error(`BACKUP_VARIANT_MISSING:${variant}`);
        return asset.key;
      };
      const original = remappedAssets.find((asset) => asset.variant === 'original');
      const restored: Memory = {
        ...memory,
        id: finalId,
        source: 'personal',
        personIds: memory.personIds.map((id) => personMap.get(id) ?? id),
        placeId: memory.placeId ? (placeMap.get(memory.placeId) ?? memory.placeId) : null,
        assetKeys: {
          micro: keyFor('micro'),
          thumbnail: keyFor('thumbnail'),
          preview: keyFor('preview'),
          ...(original ? { original: original.key } : {}),
        },
      };
      await memoryStore.put(restored);
    }

    const existingPersonalConstellations = await constellationStore
      .index('by-source')
      .getAll('personal');
    for (const existing of existingPersonalConstellations) {
      existingConstellationSignatures.add(
        constellationSignature(existing.name, existing.description, existing.memoryIds),
      );
    }
    let importedConstellations = 0;
    for (const constellation of plan.constellations) {
      const memoryIds = constellation.memoryIds
        .map((id) => memoryMap.get(id))
        .filter((id): id is string => id !== undefined);
      const uniqueMemoryIds = [...new Set(memoryIds)].sort();
      if (uniqueMemoryIds.length < 2) continue;
      const signature = constellationSignature(
        constellation.name,
        constellation.description,
        uniqueMemoryIds,
      );
      if (existingConstellationSignatures.has(signature)) continue;
      const existing = await constellationStore.get(constellation.id);
      const id = existing ? `personal-user-constellation-${crypto.randomUUID()}` : constellation.id;
      await constellationStore.put({ ...constellation, id, memoryIds: uniqueMemoryIds });
      existingConstellationSignatures.add(signature);
      importedConstellations += 1;
    }
    await transaction.objectStore('settings').put({ key: 'app-settings', value: plan.settings });
    let cacheCursor = await transaction
      .objectStore('layoutCache')
      .index('by-source')
      .openCursor('personal');
    while (cacheCursor) {
      await cacheCursor.delete();
      cacheCursor = await cacheCursor.continue();
    }
    await transaction.done;
    return {
      importedMemories: plan.memories.length - skippedMemoryIds.size,
      skippedDuplicates: skippedMemoryIds.size,
      importedAssets,
      importedConstellations,
    };
  } catch (error) {
    try {
      transaction.abort();
    } catch {
      // The transaction may already have aborted.
    }
    throw error;
  }
}
