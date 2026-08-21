import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Color, DoubleSide, MathUtils, Vector3, type Group, type MeshBasicMaterial } from 'three';

import type { Memory } from '../domain/memory';
import type { Vec3 } from '../engine/layout/layoutTypes';
import { useSceneStore } from '../stores/sceneStore';
import { useSelectionStore } from '../stores/selectionStore';
import { useSettingsStore } from '../stores/settingsStore';
import { selectMemoryLod, textureVariantForLod, type MemoryLod } from './lod/lodPolicy';
import { useManagedTexture } from './textures/useManagedTexture';

export type NodeEmphasis = 'active' | 'primary' | 'related' | 'quiet' | 'hidden' | 'normal';

interface MemoryNodeProps {
  memory: Memory;
  target: Vec3;
  emphasis: NodeEmphasis;
  collapsed?: boolean;
}

function dimensions(memory: Memory): readonly [number, number] {
  const aspect = MathUtils.clamp(memory.width / Math.max(1, memory.height), 0.58, 1.8);
  return aspect >= 1 ? [aspect, 1] : [1, 1 / aspect];
}

function opacityForEmphasis(emphasis: NodeEmphasis): number {
  if (emphasis === 'active' || emphasis === 'primary') return 1;
  if (emphasis === 'related') return 0.78;
  if (emphasis === 'hidden') return 0.015;
  if (emphasis === 'quiet') return 0.16;
  return 0.86;
}

function scaleForEmphasis(emphasis: NodeEmphasis): number {
  if (emphasis === 'active') return 2.42;
  if (emphasis === 'primary') return 1.16;
  if (emphasis === 'related') return 0.79;
  if (emphasis === 'hidden') return 0.18;
  return 0.68;
}

export function MemoryNode({
  memory,
  target,
  emphasis,
  collapsed = false,
}: MemoryNodeProps): ReactNode {
  const group = useRef<Group>(null);
  const material = useRef<MeshBasicMaterial>(null);
  const currentPosition = useRef(new Vector3(...target));
  const destination = useRef(new Vector3(...target));
  const [lod, setLod] = useState<MemoryLod>(emphasis === 'active' ? 'focus' : 'far');
  const quality = useSettingsStore((state) => state.effectiveQuality);
  const motion = useSettingsStore((state) => state.settings.motion);
  const focusMemory = useSceneStore((state) => state.focusMemory);
  const setHoveredMemory = useSceneStore((state) => state.setHoveredMemory);
  const toggleSelection = useSelectionStore((state) => state.toggle);
  const selected = useSelectionStore((state) => state.selectedIds.includes(memory.id));
  const variant = textureVariantForLod(lod);
  const assetKey = variant ? memory.assetKeys[variant] : '';
  const priority =
    emphasis === 'active' ? 100 : emphasis === 'primary' ? 70 : emphasis === 'related' ? 40 : 10;
  const texture = useManagedTexture(assetKey, variant, priority);
  const backTexture = useManagedTexture(memory.assetKeys.micro, 'micro', Math.max(1, priority - 5));
  const displayTexture = texture ?? backTexture;
  const [width, height] = dimensions(memory);
  const color = useMemo(
    () =>
      new Color(
        memory.dominantColor.rgb[0] / 255,
        memory.dominantColor.rgb[1] / 255,
        memory.dominantColor.rgb[2] / 255,
      ),
    [memory.dominantColor.rgb],
  );

  useEffect(() => {
    if (!material.current) return;
    material.current.map = displayTexture;
    material.current.needsUpdate = true;
  }, [displayTexture]);

  useFrame(({ camera }, delta) => {
    if (!group.current) return;
    destination.current.set(
      target[0],
      target[1],
      target[2],
    );
    const duration = motion === 'reduced' ? 0.2 : 0.78;
    currentPosition.current.lerp(destination.current, 1 - Math.exp(-delta / duration));
    group.current.position.copy(currentPosition.current);
    const targetScale = collapsed
      ? 0.22
      : scaleForEmphasis(emphasis);
    const scaleDuration = motion === 'reduced' ? 0.16 : 0.42;
    const scale = MathUtils.damp(group.current.scale.x, targetScale, 1 / scaleDuration, delta);
    group.current.scale.setScalar(scale);

    const distance = camera.position.distanceTo(currentPosition.current);
    const nextLod = collapsed
      ? 'far'
      : selectMemoryLod(distance, lod, emphasis === 'active', quality);
    if (nextLod !== lod) setLod(nextLod);
    if (material.current) {
      material.current.opacity = MathUtils.damp(
        material.current.opacity,
        collapsed
          ? 0.72
          : opacityForEmphasis(emphasis),
        motion === 'reduced' ? 8 : 3.4,
        delta,
      );
    }
  });

  const handleClick = (event: ThreeEvent<MouseEvent>): void => {
    event.stopPropagation();
    if (event.shiftKey) {
      toggleSelection(memory.id, true);
      return;
    }
    focusMemory(memory.id);
  };

  return (
    <group ref={group} position={target} scale={0.68} renderOrder={emphasis === 'active' ? 10 : 1}>
      <mesh
        onClick={handleClick}
        onPointerOver={(event) => {
          event.stopPropagation();
          setHoveredMemory(memory.id);
        }}
        onPointerOut={() => {
          setHoveredMemory(null);
        }}
      >
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial
          ref={material}
          map={displayTexture}
          color={displayTexture ? '#f4eee3' : color}
          opacity={collapsed ? 0.72 : opacityForEmphasis(emphasis)}
          transparent
          side={DoubleSide}
          depthWrite={emphasis === 'active'}
          toneMapped={false}
        />
      </mesh>
      {(selected || emphasis === 'primary') && (
        <mesh position={[0, 0, -0.012]} scale={[1.035, 1.055, 1]}>
          <planeGeometry args={[width, height]} />
          <meshBasicMaterial
            color={selected ? '#d7b779' : '#b8a98e'}
            opacity={selected ? 0.78 : 0.34}
            transparent
            toneMapped={false}
          />
        </mesh>
      )}
    </group>
  );
}
