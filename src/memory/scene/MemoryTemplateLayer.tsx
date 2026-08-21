import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';

import { useMemoryTemplateStore } from '../../stores/memoryTemplateStore';
import { useSceneStore } from '../../stores/sceneStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useMusicStore } from '../../stores/musicStore';
import { getMemoryTemplate, resolveTemplateConfig } from '../config';
import { LayoutEngine } from '../engine/LayoutEngine';
import { composePhaseLayouts, compositionBounds, geometricSurfaceKind } from '../engine/composePhaseLayouts';
import {
  applyPhotoFrameSafetyOffsets,
  blendPhotoFrameSafetyOffsets,
  createPhotoFrameSafetyOffsets,
  hasMeaningfulPhotoFrameSafetyOffsets,
  resolvePhotoFrameCollisions,
  type PhotoFrameSafetyOffset,
} from '../engine/photoFrameSafety';
import { ContinuousTimelineProgress } from '../engine/ContinuousTimelineProgress';
import {
  createTimelineFrame,
  evaluatePhotoStateAtFrame,
  photoFrameClusterFactor,
  type TimelineContext,
} from '../engine/TimelineEngine';
import { visiblePhotoLimit } from '../engine/templatePerformancePolicy';
import { buildSongTimelineConfig } from '../engine/SongTimeline';
import { evaluateFarewellSequence } from '../engine/FarewellSequence';
import { MemoryPhoto } from './MemoryPhoto';
import { FarewellParticles } from './FarewellParticles';
import type { TemplatePhotoState } from '../types';
import { localTextureManager } from '../../scene/textures/LocalTextureManager';

export function MemoryTemplateLayer(): ReactNode {
  const session = useMemoryTemplateStore((state) => state.session);
  const dataset = useSceneStore((state) => state.dataset);
  const source = useSceneStore((state) => state.source);
  const quality = useSettingsStore((state) => state.effectiveQuality);
  const reducedMotion = useSettingsStore((state) => state.settings.motion === 'reduced');
  const musicTrack = useMusicStore((state) => state.track);
  const musicDuration = useMusicStore((state) => state.duration);
  const canvasSize = useThree((state) => state.size);
  const viewportAspect = canvasSize.width / Math.max(1, canvasSize.height);
  const layoutBuilder = useMemo(() => new LayoutEngine(), []);

  const templateId = session?.templateId ?? null;
  const sessionSource = session?.source ?? null;
  const sessionMemoryIds = session?.memoryIds;
  const sessionOverrides = session?.overrides;
  const memoryIds = useMemo(() => sessionMemoryIds ?? [], [sessionMemoryIds]);
  const heroPhotoId = session?.heroPhotoId ?? null;
  const progress = session?.progress ?? 0;
  const status = session?.status ?? 'idle';
  const playbackKey = session?.startedAt ?? 0;
  const baseConfig = useMemo(
    () => (templateId ? resolveTemplateConfig(getMemoryTemplate(templateId), sessionOverrides) : null),
    [sessionOverrides, templateId],
  );
  const musicCueStart = musicTrack?.id ? sessionOverrides?.songCueMap?.[musicTrack.id] ?? 0 : 0;
  const songDuration = musicDuration > musicCueStart ? musicDuration - musicCueStart : baseConfig?.durationSeconds ?? 0;
  const config = useMemo(
    () => (baseConfig ? buildSongTimelineConfig(baseConfig, songDuration) : null),
    [baseConfig, songDuration],
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
    const ordered = orderedMemoryIds
      .map((id) => dataset.memories.find((memory) => memory.id === id))
      .filter((memory): memory is NonNullable<typeof memory> => Boolean(memory));
    return ordered;
  }, [dataset, orderedMemoryIds, sessionSource, source]);
  const layouts = useMemo(() => {
    if (!config || memories.length === 0) return null;
    return layoutBuilder.prepare(config, memories, heroPhotoId);
  }, [config, heroPhotoId, layoutBuilder, memories]);
  const phaseLayouts = useMemo(() => {
    if (!config || !layouts || memories.length === 0) return null;
    return composePhaseLayouts(config, memories, layouts, heroPhotoId, { aspect: viewportAspect });
  }, [config, heroPhotoId, layouts, memories, viewportAspect]);
  const timelineContext = useMemo<TimelineContext | null>(() => {
    if (!config || memories.length === 0 || !layouts || !phaseLayouts) return null;
    return { config, memories, heroPhotoId, layouts, phaseLayouts, reducedMotion, viewportAspect };
  }, [config, heroPhotoId, layouts, memories, phaseLayouts, reducedMotion, viewportAspect]);
  const visualProgress = useRef(progress);
  const progressDriver = useRef(new ContinuousTimelineProgress(0, 1));
  const frameStates = useRef(new Map<string, TemplatePhotoState>());
  const transitionSafetyTarget = useRef<ReadonlyMap<string, PhotoFrameSafetyOffset>>(new Map());
  const transitionSafetyApplied = useRef<ReadonlyMap<string, PhotoFrameSafetyOffset>>(new Map());
  const transitionSafetySignature = useRef<string | null>(null);
  const phaseSafetyOffsets = useRef<ReadonlyMap<string, PhotoFrameSafetyOffset>>(new Map());
  const phaseSafetyApplied = useRef<ReadonlyMap<string, PhotoFrameSafetyOffset>>(new Map());
  const phaseSafetySignature = useRef<string | null>(null);
  const renderedEntries = useMemo(() => {
    if (!config || memories.length === 0 || !timelineContext) return [];
    const phaseIndex = config.phases.findIndex((phase, index) => progress < phase.end || index === config.phases.length - 1);
    const currentPhase = config.phases[Math.max(0, phaseIndex)];
    if (!currentPhase) return [];
    // The taskbook promises that the complete 96-photo Demo can participate
    // in the song. Keep the quality policy for texture resolution and particle
    // density, but do not silently drop the tail of the story on the default
    // medium preset; micro textures and delayed thumbnails keep the scene
    // responsive while every photo remains eligible for a chapter.
    const baseLimit = Math.min(memories.length, Math.max(visiblePhotoLimit(quality, memories.length), 96));
    // Keep one stable scene graph for the session. The former implementation
    // mounted and unmounted cards whenever a phase window changed; React and
    // WebGL then rebuilt image materials in the same frame as the new camera
    // pose, which was the source of the opening hitch and the visible shake at
    // chapter boundaries. Hidden cards stay at zero opacity, so this does not
    // mean 96 photos are painted at once.
    const pool = [...memories]
      .toSorted((left, right) => {
        if (left.id === heroPhotoId) return -1;
        if (right.id === heroPhotoId) return 1;
        return 0;
      })
      .slice(0, baseLimit)
      .map((memory) => ({
        memory,
        index: memories.indexOf(memory),
        state: evaluatePhotoStateAtFrame(
          createTimelineFrame(progress, timelineContext),
          timelineContext,
          memory,
          memories.indexOf(memory),
        ),
      }));
    const initialStates = pool.flatMap((entry) => entry.state && entry.state.transform.opacity > 0.01 ? [entry.state] : []);
    const safeInitialStates = resolvePhotoFrameCollisions(initialStates, {
      ...compositionBounds(viewportAspect),
      clusterFactor: photoFrameClusterFactor(currentPhase),
      activeMemoryIds: initialStates.map((entry) => entry.memory.id),
    });
    const safeById = new Map(safeInitialStates.map((state) => [state.memory.id, state]));
    return pool.flatMap((entry) => {
      if (!entry.state) return [];
      const safeState = safeById.get(entry.memory.id);
      return [{
        memory: entry.memory,
        index: entry.index,
        initialState: safeState ?? entry.state,
        priority: entry.memory.id === heroPhotoId ? 200 : 120 - Math.min(100, entry.index),
      }];
    });
  }, [config, heroPhotoId, memories, progress, quality, timelineContext, viewportAspect]);

  useEffect(() => {
    const syncedProgress = useMemoryTemplateStore.getState().session?.progress ?? 0;
    progressDriver.current = new ContinuousTimelineProgress(
      syncedProgress,
      1 / Math.max(1, config?.durationSeconds ?? 1),
      performance.now() / 1000,
    );
    visualProgress.current = syncedProgress;
    frameStates.current.clear();
    transitionSafetyTarget.current = new Map();
    transitionSafetyApplied.current = new Map();
    transitionSafetySignature.current = null;
    phaseSafetyOffsets.current = new Map();
    phaseSafetyApplied.current = new Map();
    phaseSafetySignature.current = null;
  }, [config?.durationSeconds, playbackKey, templateId]);

  useEffect(() => {
    progressDriver.current.sync(progress, status === 'playing', performance.now() / 1000);
  }, [progress, status]);

  useEffect(() => {
    if (!templateId || status === 'idle' || memories.length === 0) return;
    // Do not decode dozens of textures on the same interaction that starts
    // audio. A paced background warm-up keeps the first music beat and opening
    // camera motion responsive; visible photos still acquire their own micro
    // texture immediately through MemoryPhoto.
    const warmups = memories.slice(0, Math.min(16, memories.length));
    let cursor = 0;
    let batchTimer: number | null = null;
    const warmNextBatch = (): void => {
      for (let count = 0; count < 2 && cursor < warmups.length; count += 1) {
        const memory = warmups[cursor];
        cursor += 1;
        if (!memory) continue;
        void localTextureManager
          .acquire(memory.assetKeys.micro, 'micro', 30 - cursor)
          .catch(() => null)
          .finally(() => {
            localTextureManager.release(memory.assetKeys.micro, 'micro');
          });
      }
      if (cursor < warmups.length) batchTimer = window.setTimeout(warmNextBatch, 120);
    };
    const timer = window.setTimeout(warmNextBatch, 900);
    return () => {
      window.clearTimeout(timer);
      if (batchTimer !== null) window.clearTimeout(batchTimer);
    };
  }, [memories, status, templateId]);

  useFrame((_, delta) => {
    // A texture upload or tab wake-up can hand R3F a large delta. Let the
    // audio clock continue, but keep the visual hand-off on a bounded display
    // step so collision-offset release cannot move a card several frames at
    // once.
    const visualDelta = Math.min(1 / 30, Math.max(0, Number.isFinite(delta) ? delta : 0));
    visualProgress.current = progressDriver.current.advance(performance.now() / 1000, visualDelta);
    frameStates.current.clear();
    if (timelineContext) {
      const frame = createTimelineFrame(visualProgress.current, timelineContext);
      const framePhotos: TemplatePhotoState[] = [];
      for (const entry of renderedEntries) {
        const state = evaluatePhotoStateAtFrame(frame, timelineContext, entry.memory, entry.index);
        if (state) framePhotos.push(state);
      }
      const frameActiveMemoryIds = framePhotos
        .filter((photo) => photo.transform.opacity >= 0.1)
        .map((photo) => photo.memory.id);
      const photoVolume = geometricSurfaceKind(frame.phase) !== null;
      const volumeSignature = photoVolume
        ? `${frame.phase.id}:${renderedEntries.map((entry) => entry.memory.id).join('|')}`
        : null;
      // A photo-built volume needs the same collision result during the whole
      // chapter. Re-solving every render tick was visible as a stop-start
      // motion; keeping one set of offsets lets its x/y surface drift smoothly
      // while preserving the safe gap established for this exact photo cast.
      if (volumeSignature && phaseSafetySignature.current !== volumeSignature) {
        phaseSafetyOffsets.current = createPhotoFrameSafetyOffsets(framePhotos, {
          ...compositionBounds(viewportAspect),
          clusterFactor: photoFrameClusterFactor(frame.phase),
          activeMemoryIds: frameActiveMemoryIds,
        });
        phaseSafetySignature.current = volumeSignature;
      } else if (!volumeSignature && phaseSafetySignature.current !== null) {
        phaseSafetyOffsets.current = new Map();
        phaseSafetySignature.current = null;
      }
      // Geometric chapters also need a graceful release. Otherwise the first
      // non-geometric frame clears the surface correction and cards visibly
      // snap even though the authored timeline is continuous.
      phaseSafetyApplied.current = blendPhotoFrameSafetyOffsets(
        phaseSafetyApplied.current,
        phaseSafetyOffsets.current,
        1 - Math.exp(-visualDelta * 12),
      );
      const applyPhaseSafety = photoVolume
        || hasMeaningfulPhotoFrameSafetyOffsets(phaseSafetyApplied.current);
      const safeSurfacePhotos = applyPhaseSafety
        ? applyPhotoFrameSafetyOffsets(framePhotos, phaseSafetyApplied.current)
        : framePhotos;
      // Steady scenes use the pre-composed, spacing-preserving layout directly.
      // Safety is limited to the very start of a hand-off. Keeping the
      // collision solver active for a third of every chapter updated targets
      // in visible 125ms jumps, which made the music motion look stuck.
      const inTransition = Boolean(frame.previousPhase) && frame.rawLocal < 0.14;
      const transitionSignature = inTransition
        ? `${frame.phase.id}:${renderedEntries.map((entry) => entry.memory.id).join('|')}`
        : null;
      if (inTransition && transitionSafetySignature.current !== transitionSignature) {
        transitionSafetyTarget.current = createPhotoFrameSafetyOffsets(safeSurfacePhotos, {
          ...compositionBounds(viewportAspect),
          clusterFactor: photoFrameClusterFactor(frame.phase),
          activeMemoryIds: frameActiveMemoryIds,
        });
        transitionSafetySignature.current = transitionSignature;
      } else if (!inTransition && transitionSafetySignature.current !== null) {
        transitionSafetyTarget.current = new Map();
        transitionSafetySignature.current = null;
      }
      // Release the correction toward the neutral map after the handoff. A
      // direct clear here made every affected card jump in one render tick.
      transitionSafetyApplied.current = blendPhotoFrameSafetyOffsets(
        transitionSafetyApplied.current,
        transitionSafetyTarget.current,
        1 - Math.exp(-visualDelta * 12),
      );
      const applyTransitionSafety = inTransition
        || hasMeaningfulPhotoFrameSafetyOffsets(transitionSafetyApplied.current);
      const statesForFrame = applyTransitionSafety
        ? applyPhotoFrameSafetyOffsets(safeSurfacePhotos, transitionSafetyApplied.current)
        : safeSurfacePhotos;
      for (const state of statesForFrame) {
        frameStates.current.set(state.memory.id, state);
      }
    }
  });

  if (!timelineContext || !session || session.status === 'error') return null;
  return (
    <group name="memory-template-layer" userData={{ templateId: session.templateId }}>
      {renderedEntries.map(({ memory, initialState, priority }) => (
        <MemoryPhoto
          key={memory.id}
          memory={memory}
          priority={memory.id === heroPhotoId ? 150 : priority}
          initialState={initialState}
          frameStates={frameStates}
          visible={session.status !== 'idle'}
          playbackKey={playbackKey}
        />
      ))}
      <FarewellParticles
        memories={memories}
        layout={timelineContext.layouts.mosaic}
        quality={quality}
        reducedMotion={reducedMotion}
        seed={timelineContext.config.seed}
        durationSeconds={timelineContext.config.durationSeconds}
        resolveState={() => evaluateFarewellSequence(
          visualProgress.current * timelineContext.config.durationSeconds,
          timelineContext.config.durationSeconds,
          reducedMotion,
        )}
      />
    </group>
  );
}
