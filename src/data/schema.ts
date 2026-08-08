import type { Constellation } from '../domain/constellation';
import type { Memory, MemorySource } from '../domain/memory';
import type { Person } from '../domain/person';
import type { Place } from '../domain/place';
import type { Settings } from '../domain/settings';
import type { LayoutPositions, UniverseView } from '../engine/layout/layoutTypes';
import type { DBSchema } from 'idb';

export type AssetVariant = 'micro' | 'thumbnail' | 'preview' | 'original';

export interface AssetRecord {
  key: string;
  memoryId: string;
  source: MemorySource;
  variant: AssetVariant;
  blob: Blob;
  mime: string;
  width: number;
  height: number;
  checksum: string;
  byteLength: number;
  createdAt: string;
}

export type ImportJobStage =
  | 'queued'
  | 'parsing'
  | 'resizing'
  | 'extracting'
  | 'saving'
  | 'done'
  | 'failed'
  | 'cancelled';

export interface ImportJobRecord {
  id: string;
  fileName: string;
  stage: ImportJobStage;
  progress: number;
  errorCode?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SettingsRecord {
  key: 'app-settings';
  value: Settings;
}

export interface LayoutCacheRecord {
  key: [MemorySource, UniverseView, number];
  source: MemorySource;
  view: UniverseView;
  version: number;
  positions: LayoutPositions;
  updatedAt: string;
}

export interface MementoDB extends DBSchema {
  memories: {
    key: string;
    value: Memory;
    indexes: {
      'by-source': MemorySource;
      'by-captured-at': number;
      'by-place': string;
      'by-people': string;
      'by-mood': string;
    };
  };
  assets: {
    key: string;
    value: AssetRecord;
    indexes: {
      'by-memory': string;
      'by-variant': AssetVariant;
      'by-source': MemorySource;
    };
  };
  people: {
    key: string;
    value: Person;
    indexes: {
      'by-source': MemorySource;
      'by-name': string;
    };
  };
  places: {
    key: string;
    value: Place;
    indexes: {
      'by-source': MemorySource;
      'by-name': string;
    };
  };
  constellations: {
    key: string;
    value: Constellation;
    indexes: {
      'by-source': MemorySource;
      'by-updated-at': string;
    };
  };
  settings: {
    key: string;
    value: SettingsRecord;
  };
  importJobs: {
    key: string;
    value: ImportJobRecord;
    indexes: {
      'by-stage': ImportJobStage;
      'by-updated-at': string;
    };
  };
  layoutCache: {
    key: [MemorySource, UniverseView, number];
    value: LayoutCacheRecord;
    indexes: {
      'by-source': MemorySource;
    };
  };
}

export const DATABASE_NAME = 'memento-db';
export const DATABASE_VERSION = 1;
