import { runStartupMaintenance } from '../data/maintenance';

export function bootstrapApplication(): void {
  document.documentElement.lang = 'zh-CN';
  document.documentElement.dataset.app = 'memento';
  void runStartupMaintenance().catch((error: unknown) => {
    // Local data repair is best-effort; the application remains usable if a
    // browser denies IndexedDB access or another tab is upgrading the store.
    if (import.meta.env.DEV) console.warn('Memuniverse startup maintenance skipped', error);
  });
}
