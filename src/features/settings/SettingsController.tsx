import { useEffect, type ReactNode } from 'react';

import { getSettings } from '../../data/repositories/settingsRepository';
import { useSettingsStore } from '../../stores/settingsStore';

export function SettingsController(): ReactNode {
  const setSettings = useSettingsStore((state) => state.setSettings);

  useEffect(() => {
    let active = true;
    void getSettings()
      .then((settings) => {
        if (active) setSettings(settings);
      })
      .catch(() => {
        if (active) useSettingsStore.setState({ hydrated: true });
      });
    return () => {
      active = false;
    };
  }, [setSettings]);

  return null;
}
