export type QualitySetting = 'auto' | 'high' | 'medium' | 'low';
export type MotionSetting = 'full' | 'reduced';

export interface Settings {
  quality: QualitySetting;
  motion: MotionSetting;
  includeOriginalsInBackup: boolean;
  lastUniverseMode: 'demo' | 'personal';
  schemaVersion: number;
}

export const DEFAULT_SETTINGS: Settings = {
  quality: 'auto',
  motion: 'full',
  includeOriginalsInBackup: false,
  lastUniverseMode: 'demo',
  schemaVersion: 1,
};

export function shouldReduceMotion(settings: Settings, systemPrefersReduced: boolean): boolean {
  return systemPrefersReduced || settings.motion === 'reduced';
}
