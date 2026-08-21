import type { Server } from 'node:http';

export type NeteaseConnectorApi = Record<
  string,
  (input: Record<string, unknown>) => Promise<{ body?: unknown; cookie?: unknown }>
>;

export function normalizeNeteaseCdnUrl(value: string): string | null;

export function createMementoMusicConnector(options?: {
  api?: NeteaseConnectorApi;
  dataDirectory?: string;
}): Server;

export function startMementoMusicConnector(): Promise<Server>;
