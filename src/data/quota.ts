export interface StorageQuotaSnapshot {
  usage: number;
  quota: number;
  remaining: number;
  usageRatio: number;
  persisted: boolean | null;
}

interface OptionalStorageManager {
  estimate?: () => Promise<StorageEstimate>;
  persisted?: () => Promise<boolean>;
  persist?: () => Promise<boolean>;
}

function getStorageManager(): OptionalStorageManager | undefined {
  const value: unknown = Reflect.get(navigator, 'storage');
  if (!value || typeof value !== 'object') return undefined;
  return value as OptionalStorageManager;
}

export async function readStorageQuota(): Promise<StorageQuotaSnapshot | null> {
  const storage = getStorageManager();
  if (!storage?.estimate) return null;
  const estimate = await storage.estimate();
  const quota = estimate.quota ?? 0;
  const usage = estimate.usage ?? 0;
  const persisted = storage.persisted ? await storage.persisted() : null;
  return {
    usage,
    quota,
    remaining: Math.max(0, quota - usage),
    usageRatio: quota > 0 ? usage / quota : 0,
    persisted,
  };
}

export async function requestPersistentStorage(): Promise<boolean | null> {
  const storage = getStorageManager();
  if (!storage?.persist) return null;
  return storage.persist();
}
