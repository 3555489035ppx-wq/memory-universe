import { useMemo, type CSSProperties, type ReactNode } from 'react';

import { useMemoryTemplateStore } from '../../stores/memoryTemplateStore';
import { useMusicStore } from '../../stores/musicStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { getMemoryTemplate, resolveTemplateConfig } from '../config';
import { evaluateFarewellSequence } from '../engine/FarewellSequence';
import { buildSongTimelineConfig } from '../engine/SongTimeline';

export function FarewellOverlay(): ReactNode {
  const session = useMemoryTemplateStore((state) => state.session);
  const musicTrack = useMusicStore((state) => state.track);
  const musicDuration = useMusicStore((state) => state.duration);
  const reducedMotion = useSettingsStore((state) => state.settings.motion === 'reduced');
  const templateId = session?.templateId ?? null;
  const sessionOverrides = session?.overrides;
  const baseConfig = useMemo(
    () => (templateId ? resolveTemplateConfig(getMemoryTemplate(templateId), sessionOverrides) : null),
    [sessionOverrides, templateId],
  );
  const cueStart = musicTrack?.id ? session?.overrides?.songCueMap?.[musicTrack.id] ?? 0 : 0;
  const duration = musicDuration > cueStart ? musicDuration - cueStart : baseConfig?.durationSeconds ?? 0;
  const config = useMemo(
    () => (baseConfig ? buildSongTimelineConfig(baseConfig, duration) : null),
    [baseConfig, duration],
  );
  if (!session || !config || session.status === 'error') return null;

  const farewell = evaluateFarewellSequence(
    session.progress * config.durationSeconds,
    config.durationSeconds,
    reducedMotion,
  );
  if (farewell.stage === 'idle' || farewell.stage === 'completed') return null;
  const style = {
    '--farewell-background-opacity': farewell.backgroundDim,
  } as CSSProperties;

  // The farewell message is rendered exclusively by FarewellParticles. This
  // overlay is only the cinematic dim layer, so no solid glyph can sit above
  // the particle-formed text.
  return (
    <div className="farewell-overlay" data-stage={farewell.stage} style={style} aria-live="polite">
      <div className="farewell-overlay__shade" aria-hidden="true" />
    </div>
  );
}
