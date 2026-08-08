export interface BackupFileEntry {
  path: string;
  bytes: number;
  sha256: string;
}

export interface BackupManifest {
  format: 'memento-backup';
  schemaVersion: number;
  appVersion: string;
  createdAt: string;
  sourceCounts: {
    memories: number;
    people: number;
    places: number;
    constellations: number;
  };
  assetCounts: {
    micro: number;
    thumbnails: number;
    previews: number;
    originals: number;
  };
  includesOriginals: boolean;
  files: BackupFileEntry[];
}

export type RestoreConflictStrategy = 'merge' | 'replace-personal';
