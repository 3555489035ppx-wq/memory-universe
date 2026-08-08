import { useFrame } from '@react-three/fiber';
import { useEffect, useRef, type ReactNode } from 'react';

import { useSettingsStore } from '../stores/settingsStore';
import { adjacentQuality, initialAutoQuality } from './performancePolicy';

export function PerformanceGovernor(): ReactNode {
  const qualitySetting = useSettingsStore((state) => state.settings.quality);
  const effectiveQuality = useSettingsStore((state) => state.effectiveQuality);
  const setEffectiveQuality = useSettingsStore((state) => state.setEffectiveQuality);
  const sample = useRef({ elapsed: 0, frames: 0, low: 0, high: 0, lastChange: 0 });

  useEffect(() => {
    if (qualitySetting !== 'auto') {
      setEffectiveQuality(qualitySetting);
      return;
    }
    const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    setEffectiveQuality(initialAutoQuality(window.devicePixelRatio, deviceMemory));
  }, [qualitySetting, setEffectiveQuality]);

  useFrame((state, delta) => {
    if (qualitySetting !== 'auto') return;
    sample.current.elapsed += delta;
    sample.current.frames += 1;
    if (sample.current.elapsed < 3) return;
    const fps = sample.current.frames / sample.current.elapsed;
    sample.current.elapsed = 0;
    sample.current.frames = 0;
    sample.current.low = fps < 38 ? sample.current.low + 1 : 0;
    sample.current.high = fps > 54 ? sample.current.high + 1 : 0;
    const now = state.clock.elapsedTime;
    if (now - sample.current.lastChange < 18) return;
    if (sample.current.low >= 2) {
      setEffectiveQuality(adjacentQuality(effectiveQuality, 'down'));
      sample.current.low = 0;
      sample.current.lastChange = now;
    } else if (sample.current.high >= 4) {
      setEffectiveQuality(adjacentQuality(effectiveQuality, 'up'));
      sample.current.high = 0;
      sample.current.lastChange = now;
    }
  });

  return null;
}
