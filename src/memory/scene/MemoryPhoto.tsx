import { useFrame } from '@react-three/fiber';
import { useEffect, useRef, type ReactNode } from 'react';
import { DoubleSide, MathUtils, Vector3, type Group, type MeshBasicMaterial } from 'three';

import { useSettingsStore } from '../../stores/settingsStore';
import type { TemplatePhotoState } from '../types';
import { useManagedTexture } from '../../scene/textures/useManagedTexture';

interface MemoryPhotoProps {
  state: TemplatePhotoState;
  priority: number;
  visible: boolean;
}

export function MemoryPhoto({ state, priority, visible }: MemoryPhotoProps): ReactNode {
  const group = useRef<Group>(null);
  const frontMaterial = useRef<MeshBasicMaterial>(null);
  const backMaterial = useRef<MeshBasicMaterial>(null);
  const currentPosition = useRef(new Vector3(...state.transform.position));
  const targetPosition = useRef(new Vector3(...state.transform.position));
  const motion = useSettingsStore((settings) => settings.settings.motion);
  const textureVariant = state.emphasis === 'hero' ? 'preview' : 'thumbnail';
  const textureKey = state.emphasis === 'hero' ? state.memory.assetKeys.preview : state.memory.assetKeys.thumbnail;
  const texture = useManagedTexture(textureKey, textureVariant, priority);
  const aspect = Math.min(1.8, Math.max(0.58, state.memory.width / Math.max(1, state.memory.height)));
  const width = aspect >= 1 ? aspect : 1;
  const height = aspect >= 1 ? 1 : 1 / aspect;

  useEffect(() => {
    if (frontMaterial.current) {
      frontMaterial.current.map = texture;
      frontMaterial.current.needsUpdate = true;
    }
    if (backMaterial.current) {
      backMaterial.current.map = texture;
      backMaterial.current.needsUpdate = true;
    }
  }, [texture]);

  useFrame(({ camera }, delta) => {
    if (!group.current) return;
    const transform = state.transform;
    const duration = motion === 'reduced' ? 0.15 : 0.45;
    targetPosition.current.set(...transform.position);
    currentPosition.current.lerp(targetPosition.current, 1 - Math.exp(-delta / duration));
    group.current.position.copy(currentPosition.current);
    group.current.rotation.x = MathUtils.damp(group.current.rotation.x, transform.rotation[0], 3.2, delta);
    group.current.rotation.y = MathUtils.damp(group.current.rotation.y, transform.rotation[1], 3.2, delta);
    group.current.rotation.z = MathUtils.damp(group.current.rotation.z, transform.rotation[2], 3.2, delta);
    const targetScale = visible ? transform.scale : 0.001;
    const scale = MathUtils.damp(group.current.scale.x, targetScale, motion === 'reduced' ? 12 : 6, delta);
    group.current.scale.setScalar(scale);
    const opacity = visible ? transform.opacity : 0;
    if (frontMaterial.current) {
      frontMaterial.current.opacity = MathUtils.damp(frontMaterial.current.opacity, opacity, 8, delta);
    }
    if (backMaterial.current) {
      backMaterial.current.opacity = MathUtils.damp(backMaterial.current.opacity, opacity * 0.92, 8, delta);
    }
    group.current.lookAt(camera.position.x, camera.position.y, group.current.position.z);
  });

  return (
    <group ref={group} position={state.transform.position} scale={visible ? state.transform.scale : 0.001}>
      <mesh renderOrder={state.emphasis === 'hero' ? 30 : 20}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial
          ref={frontMaterial}
          map={texture}
          color={texture ? '#ffffff' : state.memory.dominantColor.rgb.map((value) => value / 255) as [number, number, number]}
          opacity={visible ? state.transform.opacity : 0}
          transparent
          side={DoubleSide}
          depthWrite={state.emphasis === 'hero'}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0, 0, -0.008]} rotation={[0, Math.PI, 0]} renderOrder={19}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial ref={backMaterial} map={texture} color="#dfe8ef" opacity={visible ? state.transform.opacity * 0.92 : 0} transparent side={DoubleSide} toneMapped={false} />
      </mesh>
    </group>
  );
}
