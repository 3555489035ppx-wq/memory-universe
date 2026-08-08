import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { MathUtils, type BufferAttribute } from 'three';

import type { Relationship } from '../domain/relationship';
import type { Vec3 } from '../engine/layout/layoutTypes';
import { useSceneStore } from '../stores/sceneStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useSceneLayout } from './useSceneLayout';

interface RelationshipLineProps {
  relationship: Relationship;
  source: Vec3;
  target: Vec3;
}

function RelationshipLine({ relationship, source, target }: RelationshipLineProps): ReactNode {
  const [initialValues] = useState(() => new Float32Array([...source, ...target]));
  const attribute = useRef<BufferAttribute>(null);

  useFrame((_, delta) => {
    if (!attribute.current) return;
    const values = attribute.current.array as Float32Array;
    const next = [...source, ...target];
    const amount = 1 - Math.exp(-delta / 0.72);
    for (let index = 0; index < values.length; index += 1) {
      values[index] = MathUtils.lerp(values[index] ?? 0, next[index] ?? 0, amount);
    }
    attribute.current.needsUpdate = true;
  });

  return (
    <lineSegments renderOrder={0}>
      <bufferGeometry>
        <bufferAttribute ref={attribute} attach="attributes-position" args={[initialValues, 3]} />
      </bufferGeometry>
      <lineBasicMaterial
        color="#bcae96"
        opacity={MathUtils.clamp(relationship.score * 0.42, 0.08, 0.32)}
        transparent
        depthWrite={false}
        toneMapped={false}
      />
    </lineSegments>
  );
}

export function RelationshipLines(): ReactNode {
  const relationships = useSceneStore((state) => state.relationships);
  const { positions, allowedMemoryIds } = useSceneLayout();
  const activeMemoryId = useSceneStore((state) => state.activeMemoryId);
  const focusedMemoryId = useSceneStore((state) => state.focusedMemoryId);
  const hoveredMemoryId = useSceneStore((state) => state.hoveredMemoryId);
  const quality = useSettingsStore((state) => state.effectiveQuality);
  const emphasisId = activeMemoryId ?? focusedMemoryId ?? hoveredMemoryId;
  const visible = useMemo(() => {
    const ranked = relationships
      .filter(
        (relationship) =>
          !allowedMemoryIds ||
          (allowedMemoryIds.has(relationship.sourceId) && allowedMemoryIds.has(relationship.targetId)),
      )
      .toSorted(
      (left, right) =>
        right.score - left.score ||
        `${left.sourceId}:${left.targetId}`.localeCompare(`${right.sourceId}:${right.targetId}`),
    );
    if (emphasisId) {
      return ranked
        .filter(
          (relationship) =>
            relationship.sourceId === emphasisId || relationship.targetId === emphasisId,
        )
        .slice(0, quality === 'low' ? 4 : 8);
    }
    if (quality === 'low') return [];
    return ranked.filter((relationship) => relationship.score >= 0.62).slice(0, 12);
  }, [allowedMemoryIds, emphasisId, quality, relationships]);

  if (!positions) return null;
  return (
    <group>
      {visible.map((relationship) => {
        const source = positions[relationship.sourceId];
        const target = positions[relationship.targetId];
        if (!source || !target) return null;
        return (
          <RelationshipLine
            key={`${relationship.sourceId}:${relationship.targetId}`}
            relationship={relationship}
            source={source}
            target={target}
          />
        );
      })}
    </group>
  );
}
