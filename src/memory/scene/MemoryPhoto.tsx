import { useFrame } from '@react-three/fiber';
import { memo, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import {
  DoubleSide,
  Euler,
  MathUtils,
  PlaneGeometry,
  Quaternion,
  Vector3,
  type Group,
  type MeshBasicMaterial,
} from 'three';

import type { Memory } from '../../domain/memory';
import { useSettingsStore } from '../../stores/settingsStore';
import { useSceneStore } from '../../stores/sceneStore';
import type { TemplatePhotoState } from '../types';
import { useManagedTexture } from '../../scene/textures/useManagedTexture';
import { dimensions } from '../layouts/shared';

interface MemoryPhotoProps {
  memory: Memory;
  initialState: TemplatePhotoState;
  frameStates: RefObject<Map<string, TemplatePhotoState>>;
  priority: number;
  visible: boolean;
  playbackKey: number;
}

const sharedPhotoGeometry = new PlaneGeometry(1, 1);

export const MemoryPhoto = memo(function MemoryPhoto({ memory, initialState, frameStates, priority, visible, playbackKey }: MemoryPhotoProps): ReactNode {
  const group = useRef<Group>(null);
  const frame = useRef<Group>(null);
  const frontMaterial = useRef<MeshBasicMaterial>(null);
  const initialTransform = initialState.transform;
  const currentPosition = useRef(new Vector3(...initialTransform.position));
  const targetPosition = useRef(new Vector3(...initialTransform.position));
  const authoredEuler = useRef(new Euler());
  const authoredQuaternion = useRef(new Quaternion());
  const targetQuaternion = useRef(new Quaternion());
  const playbackKeyRef = useRef<number | null>(null);
  const motion = useSettingsStore((settings) => settings.settings.motion);
  const [microEnabled, setMicroEnabled] = useState(initialTransform.opacity > 0.05 && priority >= 145);
  useEffect(() => {
    // Keep the first interaction responsive: visible cards get a micro image
    // in a short priority wave, while hidden cards acquire it in the
    // background. All cards remain mounted and will eventually be ready, but
    // the opening frame no longer decodes 96 images at once.
    const initiallyVisible = initialTransform.opacity > 0.05;
    const delay = initiallyVisible
      ? priority >= 145 ? 0 : Math.min(720, 90 + Math.max(0, 145 - priority) * 4)
      : Math.min(2_800, 900 + Math.max(0, 120 - priority) * 10);
    const timer = window.setTimeout(() => setMicroEnabled(true), delay);
    return () => window.clearTimeout(timer);
  }, [initialTransform.opacity, memory.assetKeys.micro, priority]);
  const microTexture = useManagedTexture(
    memory.assetKeys.micro,
    'micro',
    priority + 120,
    microEnabled,
  );
  const [detailEnabled, setDetailEnabled] = useState(false);
  useEffect(() => {
    let active = true;
    // The opening hero becomes crisp first. Remaining cards upgrade only after
    // the browser has had time to draw the opening motion, rather than asking
    // WebGL to upload every thumbnail on the same click that starts audio.
    const delay = initialTransform.opacity > 0.05
      ? priority >= 150 ? 240 : Math.min(2_100, 600 + Math.max(0, 120 - priority) * 10)
      : Math.min(4_200, 1_500 + Math.max(0, 120 - priority) * 14);
    const timer = window.setTimeout(() => {
      if (active) setDetailEnabled(true);
    }, delay);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [initialTransform.opacity, memory.assetKeys.thumbnail, priority]);
  const detailTexture = useManagedTexture(
    memory.assetKeys.thumbnail,
    detailEnabled ? 'thumbnail' : null,
    priority,
  );
  const texture = detailTexture ?? microTexture;
  const [width, height] = dimensions(memory);
  const [red, green, blue] = memory.dominantColor.rgb;
  const placeholderColor = `rgb(${String(Math.round(red * 0.58 + 28))}, ${String(Math.round(green * 0.58 + 28))}, ${String(Math.round(blue * 0.58 + 28))})`;

  useEffect(() => {
    if (frontMaterial.current) {
      frontMaterial.current.map = texture;
      frontMaterial.current.color.set(texture ? '#ffffff' : placeholderColor);
      frontMaterial.current.needsUpdate = true;
    }
  }, [placeholderColor, texture]);

  useFrame(({ camera }, delta) => {
    if (!group.current || !frame.current) return;
    // A replay keeps the stable photo pool mounted, so reset each card's
    // integrator at the new run boundary instead of easing from the previous
    // film's final position.
    if (playbackKeyRef.current !== playbackKey) {
      playbackKeyRef.current = playbackKey;
      currentPosition.current.set(...initialTransform.position);
      targetPosition.current.set(...initialTransform.position);
      group.current.position.copy(currentPosition.current);
      group.current.scale.setScalar(visible ? initialTransform.scale : 0.001);
      group.current.visible = visible;
      frame.current.quaternion.copy(camera.quaternion);
      if (frontMaterial.current) {
        frontMaterial.current.opacity = visible ? initialTransform.opacity : 0;
      }
    }
    const state = frameStates.current.get(memory.id) ?? initialState;
    const transform = state.transform;
    const duration = motion === 'reduced'
      ? 0.1
      : state.lifecycle.stage === 'entering' ? 0.18 : 0.14;
    // A stalled browser frame must not make a card jump through the whole
    // missed interval on the next tick. The timeline clock continues, but the
    // visual integrator advances at a bounded display step, removing the
    // vertical snap seen when an image upload or audio event briefly blocks.
    const visualDelta = Math.min(1 / 30, Math.max(0, Number.isFinite(delta) ? delta : 0));
    targetPosition.current.set(
      transform.position[0],
      transform.position[1],
      transform.position[2],
    );
    currentPosition.current.lerp(targetPosition.current, 1 - Math.exp(-visualDelta / duration));
    group.current.position.copy(currentPosition.current);
    const readabilityScale = state.emphasis === 'hero' ? 1.06 : state.emphasis === 'related' ? 1.05 : 1;
    const targetScale = visible
      ? transform.scale * readabilityScale
      : 0.001;
    const scale = MathUtils.damp(group.current.scale.x, targetScale, motion === 'reduced' ? 12 : 6, visualDelta);
    group.current.scale.setScalar(scale);
    const opacity = visible ? transform.opacity : 0;
    if (frontMaterial.current) {
      frontMaterial.current.opacity = MathUtils.damp(frontMaterial.current.opacity, opacity, 8, visualDelta);
    }
    const currentOpacity = frontMaterial.current?.opacity ?? 0;
    if (!visible || (opacity <= 0.006 && currentOpacity <= 0.008 && state.lifecycle.removable)) {
      group.current.visible = false;
      return;
    }
    group.current.visible = (!state.lifecycle.removable || currentOpacity > 0.008)
      && (opacity > 0.006 || currentOpacity > 0.008);
    // Flat scenes remain camera-facing for readability. Photo-built volumes
    // keep their authored normal instead of being billboarded every frame;
    // the combination of z-depth and normal rotation is what makes the
    // cylinder/sphere/star/prism read as an actual 3D surface.
    authoredEuler.current.set(
      MathUtils.clamp(transform.rotation[0], state.surface === 'geometric' ? -0.32 : -0.08, state.surface === 'geometric' ? 0.32 : 0.08),
      MathUtils.clamp(transform.rotation[1], state.surface === 'geometric' ? -0.82 : -0.42, state.surface === 'geometric' ? 0.82 : 0.42),
      MathUtils.clamp(transform.rotation[2], state.surface === 'geometric' ? -0.18 : -0.12, state.surface === 'geometric' ? 0.18 : 0.12),
    );
    authoredQuaternion.current.setFromEuler(authoredEuler.current);
    targetQuaternion.current.copy(camera.quaternion).multiply(authoredQuaternion.current);
    frame.current.quaternion.slerp(
      targetQuaternion.current,
      1 - Math.exp(-visualDelta * (motion === 'reduced' ? 16 : 12)),
    );
  });

  return (
    <group ref={group} position={initialTransform.position} scale={visible ? initialTransform.scale : 0.001}>
      <group ref={frame}>
        <mesh
          visible
          name={`memory-photo-${memory.id}`}
          renderOrder={initialState.emphasis === 'hero' ? 30 : 20}
          scale={[width, height, 1]}
          onClick={(event) => {
            event.stopPropagation();
            useSceneStore.getState().requestMemory(memory.id);
          }}
        >
          <primitive object={sharedPhotoGeometry} attach="geometry" />
          <meshBasicMaterial
            ref={frontMaterial}
            map={texture}
            color={texture ? '#ffffff' : placeholderColor}
            opacity={visible ? initialTransform.opacity : 0}
            transparent
            side={DoubleSide}
            depthWrite={initialState.emphasis === 'hero'}
            toneMapped={false}
          />
        </mesh>
      </group>
    </group>
  );
}, (previous, next) => (
  previous.memory.id === next.memory.id
  && previous.priority === next.priority
  && previous.visible === next.visible
  && previous.playbackKey === next.playbackKey
  && previous.frameStates === next.frameStates
));
