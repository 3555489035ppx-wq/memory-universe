import { useEffect, useMemo, type ReactNode } from 'react';

import type { Memory } from '../domain/memory';
import { useSceneStore } from '../stores/sceneStore';
import { useSelectionStore } from '../stores/selectionStore';
import { useSettingsStore } from '../stores/settingsStore';
import { MemoryNode, type NodeEmphasis } from './MemoryNode';
import { NODE_LIMITS, TEXTURE_BUDGETS } from './lod/lodPolicy';
import { localTextureManager } from './textures/LocalTextureManager';
import { useSceneLayout } from './useSceneLayout';

function visibleInRange(
  memory: Memory,
  earliest: number,
  span: number,
  range: readonly [number, number],
): boolean {
  if (memory.capturedAtMs === null) return true;
  const percentile = ((memory.capturedAtMs - earliest) / span) * 100;
  return percentile >= range[0] && percentile <= range[1];
}

export function MemoryLODRenderer(): ReactNode {
  const dataset = useSceneStore((state) => state.dataset);
  const relationships = useSceneStore((state) => state.relationships);
  const { positions, allowedMemoryIds } = useSceneLayout();
  const timeRange = useSceneStore((state) => state.timeRange);
  const hoveredMemoryId = useSceneStore((state) => state.hoveredMemoryId);
  const focusedMemoryId = useSceneStore((state) => state.focusedMemoryId);
  const activeMemoryId = useSceneStore((state) => state.activeMemoryId);
  const hubFocusId = useSceneStore((state) => state.hubFocusId);
  const mode = useSceneStore((state) => state.mode);
  const collapsed = useSceneStore((state) => state.collapsed);
  const selectedIds = useSelectionStore((state) => state.selectedIds);
  const quality = useSettingsStore((state) => state.effectiveQuality);

  useEffect(() => {
    localTextureManager.setByteBudget(TEXTURE_BUDGETS[quality]);
  }, [quality]);

  const visible = useMemo(() => {
    const memories = dataset?.memories ?? [];
    const emphasisId = activeMemoryId ?? focusedMemoryId ?? hoveredMemoryId;
    return memories
      .filter((memory) => !allowedMemoryIds || allowedMemoryIds.has(memory.id))
      .toSorted((left, right) => {
        if (left.id === emphasisId) return -1;
        if (right.id === emphasisId) return 1;
        return left.id.localeCompare(right.id);
      })
      .slice(0, NODE_LIMITS[quality]);
  }, [activeMemoryId, allowedMemoryIds, dataset?.memories, focusedMemoryId, hoveredMemoryId, quality]);

  const rangeMemoryIds = useMemo(() => {
    const memories = dataset?.memories ?? [];
    const dated = memories
      .map((memory) => memory.capturedAtMs)
      .filter((value): value is number => value !== null);
    const earliest = dated.length > 0 ? Math.min(...dated) : 0;
    const latest = dated.length > 0 ? Math.max(...dated) : 1;
    return new Set(
      memories
        .filter((memory) =>
          visibleInRange(memory, earliest, Math.max(1, latest - earliest), timeRange),
        )
        .map((memory) => memory.id),
    );
  }, [dataset?.memories, timeRange]);

  const emphasisId = activeMemoryId ?? focusedMemoryId ?? hoveredMemoryId;
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const hubMemoryIds = useMemo(
    () =>
      new Set(
        hubFocusId
          ? (dataset?.memories ?? [])
              .filter((memory) => memory.personIds.includes(hubFocusId))
              .map((memory) => memory.id)
          : [],
      ),
    [dataset?.memories, hubFocusId],
  );
  const relatedIds = useMemo(() => {
    if (!emphasisId) return new Set<string>();
    return new Set(
      relationships.flatMap((relationship) => {
        if (relationship.sourceId === emphasisId) return [relationship.targetId];
        if (relationship.targetId === emphasisId) return [relationship.sourceId];
        return [];
      }),
    );
  }, [emphasisId, relationships]);

  if (
    !positions ||
    !dataset ||
    (mode !== 'universe' && mode !== 'memory' && mode !== 'constellation')
  ) return null;

  return (
    <group>
      {visible.map((memory, index) => {
        const layoutTarget = positions[memory.id];
        const angle = index * 2.399_963;
        const collapseRadius = 0.18 + (index % 7) * 0.035;
        const target = collapsed
          ? ([
              Math.cos(angle) * collapseRadius,
              Math.sin(angle) * collapseRadius,
              -1 + ((index % 9) - 4) * 0.018,
            ] as const)
          : layoutTarget;
        if (!target) return null;
        let emphasis: NodeEmphasis = 'normal';
        if (memory.id === activeMemoryId) emphasis = 'active';
        else if (memory.id === emphasisId) emphasis = 'primary';
        else if (!rangeMemoryIds.has(memory.id)) emphasis = 'hidden';
        else if (selectedIds.length > 1 && selectedSet.has(memory.id)) emphasis = 'related';
        else if (selectedIds.length > 1) emphasis = 'quiet';
        else if (hubFocusId && hubMemoryIds.has(memory.id)) emphasis = 'related';
        else if (hubFocusId) emphasis = 'quiet';
        else if (emphasisId && relatedIds.has(memory.id)) emphasis = 'related';
        else if (emphasisId) emphasis = 'quiet';
        return (
          <MemoryNode
            key={memory.id}
            memory={memory}
            target={target}
            emphasis={emphasis}
            collapsed={collapsed}
          />
        );
      })}
    </group>
  );
}
