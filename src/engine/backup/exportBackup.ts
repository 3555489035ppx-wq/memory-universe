import { Zip, ZipDeflate, ZipPassThrough, strToU8 } from 'fflate';

import { listConstellations } from '../../data/repositories/constellationRepository';
import { listAssets, listMemories } from '../../data/repositories/memoryRepository';
import { listPeople } from '../../data/repositories/peopleRepository';
import { listPlaces } from '../../data/repositories/placesRepository';
import { getSettings } from '../../data/repositories/settingsRepository';
import type { AssetRecord, AssetVariant } from '../../data/schema';
import type { BackupManifest } from '../../domain/backup';
import { BACKUP_LIMITS } from './backupLimits';

export interface BackupProgress {
  completed: number;
  total: number;
  stage: 'collecting' | 'hashing' | 'packaging';
  label: string;
}

export interface ExportBackupOptions {
  includeOriginals: boolean;
  signal?: AbortSignal;
  onProgress?: (progress: BackupProgress) => void;
}

interface BackupAssetMetadata extends Omit<AssetRecord, 'blob'> {
  backupPath: string;
}

interface BackupFile {
  path: string;
  data: Uint8Array<ArrayBuffer>;
  compress: boolean;
}

function abortIfNeeded(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new DOMException('备份已取消。', 'AbortError');
}

function extensionForMime(mime: string): string {
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/png') return 'png';
  if (mime === 'image/avif') return 'avif';
  return 'webp';
}

function directoryForVariant(variant: AssetVariant): string {
  if (variant === 'thumbnail') return 'thumbnails';
  if (variant === 'preview') return 'previews';
  if (variant === 'original') return 'originals';
  return 'micro';
}

function assetPath(asset: AssetRecord): string {
  const safeKey = encodeURIComponent(asset.key).replaceAll('%', '_');
  return `assets/${directoryForVariant(asset.variant)}/${safeKey}.${extensionForMime(asset.mime)}`;
}

function blobBytes(blob: Blob): Promise<Uint8Array<ArrayBuffer>> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) resolve(new Uint8Array(reader.result));
      else reject(new Error('BACKUP_BLOB_READ_FAILED'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('BACKUP_BLOB_READ_FAILED'));
    reader.readAsArrayBuffer(blob);
  });
}

export async function sha256Hex(data: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function zipFiles(
  files: readonly BackupFile[],
  signal: AbortSignal | undefined,
  onProgress: ExportBackupOptions['onProgress'],
): Promise<Blob> {
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let resolveOutput!: (blob: Blob) => void;
  let rejectOutput!: (error: unknown) => void;
  const output = new Promise<Blob>((resolve, reject) => {
    resolveOutput = resolve;
    rejectOutput = reject;
  });
  const zip = new Zip((error, chunk, final) => {
    if (error) {
      rejectOutput(error);
      return;
    }
    chunks.push(chunk);
    if (final) resolveOutput(new Blob(chunks, { type: 'application/zip' }));
  });
  const abort = (): void => {
    zip.terminate();
    rejectOutput(new DOMException('备份已取消。', 'AbortError'));
  };
  signal?.addEventListener('abort', abort, { once: true });
  try {
    for (let index = 0; index < files.length; index += 1) {
      abortIfNeeded(signal);
      const file = files[index];
      if (!file) continue;
      const entry = file.compress
        ? new ZipDeflate(file.path, { level: 6 })
        : new ZipPassThrough(file.path);
      zip.add(entry);
      if (file.data.byteLength === 0) {
        entry.push(new Uint8Array(), true);
      } else {
        for (let offset = 0; offset < file.data.byteLength; offset += BACKUP_LIMITS.chunkBytes) {
          abortIfNeeded(signal);
          const end = Math.min(file.data.byteLength, offset + BACKUP_LIMITS.chunkBytes);
          entry.push(file.data.subarray(offset, end), end === file.data.byteLength);
        }
      }
      onProgress?.({
        completed: index + 1,
        total: files.length,
        stage: 'packaging',
        label: file.path,
      });
    }
    zip.end();
    return await output;
  } finally {
    signal?.removeEventListener('abort', abort);
  }
}

export async function exportPersonalBackup(options: ExportBackupOptions): Promise<{
  blob: Blob;
  manifest: BackupManifest;
}> {
  abortIfNeeded(options.signal);
  options.onProgress?.({ completed: 0, total: 1, stage: 'collecting', label: '读取本地数据' });
  const [memories, people, places, constellations, settings, allAssets] = await Promise.all([
    listMemories('personal'),
    listPeople('personal'),
    listPlaces('personal'),
    listConstellations('personal'),
    getSettings(),
    listAssets('personal'),
  ]);
  const assets = allAssets.filter(
    (asset) => asset.variant !== 'original' || options.includeOriginals,
  );
  const memoriesForBackup = memories.map((memory) => {
    if (options.includeOriginals || !memory.assetKeys.original) return memory;
    const assetKeys = { ...memory.assetKeys };
    delete assetKeys.original;
    return { ...memory, assetKeys };
  });
  const assetMetadata: BackupAssetMetadata[] = [];
  const payloadFiles: BackupFile[] = [];
  const jsonFiles = [
    { path: 'people.json', value: people },
    { path: 'places.json', value: places },
    { path: 'constellations.json', value: constellations },
    { path: 'settings.json', value: settings },
  ];
  for (const file of jsonFiles) {
    payloadFiles.push({
      path: file.path,
      data: strToU8(JSON.stringify(file.value, null, 2)),
      compress: true,
    });
  }
  for (const asset of assets) {
    abortIfNeeded(options.signal);
    const backupPath = assetPath(asset);
    const data = await blobBytes(asset.blob);
    assetMetadata.push({
      key: asset.key,
      memoryId: asset.memoryId,
      source: asset.source,
      variant: asset.variant,
      mime: asset.mime,
      width: asset.width,
      height: asset.height,
      checksum: asset.checksum,
      byteLength: asset.byteLength,
      createdAt: asset.createdAt,
      backupPath,
    });
    payloadFiles.push({ path: backupPath, data, compress: false });
  }
  payloadFiles.push({
    path: 'metadata.json',
    data: strToU8(JSON.stringify({ memories: memoriesForBackup, assets: assetMetadata }, null, 2)),
    compress: true,
  });

  const fileEntries: BackupManifest['files'] = [];
  for (let index = 0; index < payloadFiles.length; index += 1) {
    abortIfNeeded(options.signal);
    const file = payloadFiles[index];
    if (!file) continue;
    fileEntries.push({
      path: file.path,
      bytes: file.data.byteLength,
      sha256: await sha256Hex(file.data),
    });
    options.onProgress?.({
      completed: index + 1,
      total: payloadFiles.length,
      stage: 'hashing',
      label: file.path,
    });
  }
  const countVariant = (variant: AssetVariant): number =>
    assets.filter((asset) => asset.variant === variant).length;
  const manifest: BackupManifest = {
    format: 'memento-backup',
    schemaVersion: 1,
    appVersion: '1.0.0',
    createdAt: new Date().toISOString(),
    sourceCounts: {
      memories: memories.length,
      people: people.length,
      places: places.length,
      constellations: constellations.length,
    },
    assetCounts: {
      micro: countVariant('micro'),
      thumbnails: countVariant('thumbnail'),
      previews: countVariant('preview'),
      originals: countVariant('original'),
    },
    includesOriginals: options.includeOriginals,
    files: fileEntries,
  };
  const manifestFile: BackupFile = {
    path: 'manifest.json',
    data: strToU8(JSON.stringify(manifest, null, 2)),
    compress: true,
  };
  const blob = await zipFiles([manifestFile, ...payloadFiles], options.signal, options.onProgress);
  return { blob, manifest };
}
