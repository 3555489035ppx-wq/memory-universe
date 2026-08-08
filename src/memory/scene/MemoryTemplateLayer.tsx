import { useMemo, type ReactNode } from 'react';

import { useMemoryTemplateStore } from '../../stores/memoryTemplateStore';
import { useSceneStore } from '../../stores/sceneStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { getMemoryTemplate, resolveTemplateConfig } from '../config';
import { LayoutEngine } from '../engine/LayoutEngine';
import { evaluateTemplateState } from '../engine/TimelineEngine';
import { visiblePhotoLimit } from '../engine/templatePerformancePolicy';
import { MemoryPhoto } from './MemoryPhoto';

export function MemoryTemplateLayer(): ReactNode {
  const session = useMemoryTemplateStore((state) => state.session);
  const dataset = useSceneStore((state) => state.dataset);
  const source = useSceneStore((state) => state.source);
  const quality = useSettingsStore((state) => state.effectiveQuality);
  const layoutBuilder = useMemo(() => new LayoutEngine(), []);

  const templateId = session?.templateId ?? null;
  const sessionSource = session?.source ?? null;
  const sessionMemoryIds = session?.memoryIds;
  const sessionOverrides = session?.overrides;
  const memoryIds = useMemo(() => sessionMemoryIds ?? [], [sessionMemoryIds]);
  const heroPhotoId = session?.heroPhotoId ?? null;
  const progress = session?.progress ?? 0;
  const config = useMemo(
    () => (templateId ? resolveTemplateConfig(getMemoryTemplate(templateId), sessionOverrides) : null),
    [sessionOverrides, templateId],
  );
  const orderedMemoryIds = useMemo(() => {
    const overrideOrder = sessionOverrides?.photoOrder;
    if (!overrideOrder) return memoryIds;
    const available = new Set(memoryIds);
    const ordered = overrideOrder.filter((id) => available.has(id));
    const remainder = memoryIds.filter((id) => !ordered.includes(id));
    return [...ordered, ...remainder];
  }, [memoryIds, sessionOverrides]);
  const memories = useMemo(() => {
    if (!dataset || sessionSource !== source) return [];
    return orderedMemoryIds
      .map((id) => dataset.memories.find((memory) => memory.id === id))
      .filter((memory): memory is NonNullable<typeof memory> => Boolean(memory));
  }, [dataset, orderedMemoryIds, sessionSource, source]);
  const layouts = useMemo(() => {
    if (!config || memories.length === 0) return null;
    return layoutBuilder.prepare(config, memories, heroPhotoId);
  }, [config, heroPhotoId, layoutBuilder, memories]);
  const frame = useMemo(() => {
    if (!config || memories.length === 0 || !layouts) return null;
    return evaluateTemplateState(progress, { config, memories, heroPhotoId, layouts });
  }, [config, heroPhotoId, layouts, memories, progress]);

  if (!frame || !session || session.status === 'error') return null;
  const limit = visiblePhotoLimit(quality, frame.photos.length);
  const visiblePhotos = frame.photos.slice(0, limit);
  return (
    <group name="memory-template-layer" userData={{ templateId: session.templateId, phase: frame.phase.id }}>
      {visiblePhotos.map((photo, index) => (
        <MemoryPhoto key={photo.memory.id} state={photo} priority={photo.emphasis === 'hero' ? 90 : 40 - index} visible={session.status !== 'idle'} />
      ))}
    </group>
  );
}
