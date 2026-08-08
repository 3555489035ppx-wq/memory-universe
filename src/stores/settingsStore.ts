import { create } from 'zustand';

import { DEFAULT_SETTINGS, type QualitySetting, type Settings } from '../domain/settings';

export type EffectiveQuality = Exclude<QualitySetting, 'auto'>;

interface SettingsState {
  settings: Settings;
  effectiveQuality: EffectiveQuality;
  hydrated: boolean;
  setSettings: (settings: Settings) => void;
  setQuality: (quality: QualitySetting) => void;
  setEffectiveQuality: (quality: EffectiveQuality) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: DEFAULT_SETTINGS,
  effectiveQuality: 'medium',
  hydrated: false,
  setSettings: (settings) =>
    set({
      settings,
      effectiveQuality: settings.quality === 'auto' ? 'medium' : settings.quality,
      hydrated: true,
    }),
  setQuality: (quality) =>
    set((state) => ({
      settings: { ...state.settings, quality },
      ...(quality === 'auto' ? {} : { effectiveQuality: quality }),
    })),
  setEffectiveQuality: (effectiveQuality) => set({ effectiveQuality }),
}));
