import {
  CameraControls as DreiCameraControls,
  type CameraControls as CameraControlsInstance,
} from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { PerspectiveCamera, Vector3 } from 'three';

import { useSceneStore } from '../stores/sceneStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useSceneLayout } from './useSceneLayout';
import {
  CameraPoseStack,
  CameraStateMachine,
  type CameraPose,
  type CameraState,
} from './camera/CameraStateMachine';

const UNIVERSE_POSITION = new Vector3(0, 0.4, 15);
const UNIVERSE_TARGET = new Vector3(0, 0, -1.5);

function poseFromControls(
  controls: CameraControlsInstance,
  cameraParameters: Pick<PerspectiveCamera, 'fov' | 'near' | 'far'>,
  view: CameraPose['view'],
  focusedMemoryId: string | null,
): CameraPose {
  const position = controls.getPosition(new Vector3());
  const target = controls.getTarget(new Vector3());
  return {
    position: [position.x, position.y, position.z],
    target: [target.x, target.y, target.z],
    fov: cameraParameters.fov,
    near: cameraParameters.near,
    far: cameraParameters.far,
    view,
    focusedMemoryId,
  };
}

function transitionState(reduced: boolean, fallback: CameraState): CameraState {
  return reduced ? 'reduced-transition' : fallback;
}

export function CameraRig(): ReactNode {
  const camera = useThree((state) => state.camera);
  const controlsRef = useRef<CameraControlsInstance | null>(null);
  const [controlsReady, setControlsReady] = useState(false);
  const mode = useSceneStore((state) => state.mode);
  const view = useSceneStore((state) => state.view);
  const { positions: scenePositions } = useSceneLayout();
  const activeMemoryId = useSceneStore((state) => state.activeMemoryId);
  const focusedMemoryId = useSceneStore((state) => state.focusedMemoryId);
  const setCameraState = useSceneStore((state) => state.setCameraState);
  const motionSetting = useSettingsStore((state) => state.settings.motion);
  const machine = useRef(new CameraStateMachine());
  const poses = useRef(new CameraPoseStack());
  const previousMode = useRef(mode);
  const previousActive = useRef<string | null>(activeMemoryId);

  const handleControls = useCallback((instance: CameraControlsInstance | null) => {
    controlsRef.current = instance;
    setControlsReady(instance !== null);
  }, []);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls || !(camera instanceof PerspectiveCamera)) return;
    const stateMachine = machine.current;
    const poseStack = poses.current;
    const priorMode = previousMode.current;
    const priorActive = previousActive.current;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const reduced = motionSetting === 'reduced' || prefersReduced;
    controls.smoothTime = reduced ? 0.2 : 0.82;
    controls.draggingSmoothTime = reduced ? 0.08 : 0.18;
    let cancelled = false;

    const run = async (): Promise<void> => {
      if (mode === 'memory' && activeMemoryId) {
        const target = scenePositions?.[activeMemoryId];
        if (!target) return;
        const isEcho = priorMode === 'memory' && priorActive !== activeMemoryId;
        if (priorMode !== 'memory' && poseStack.size === 0) {
          poseStack.push(
            poseFromControls(
              controls,
              { fov: camera.fov, near: camera.near, far: camera.far },
              view,
              focusedMemoryId,
            ),
          );
        }
        previousMode.current = mode;
        previousActive.current = activeMemoryId;
        const state = transitionState(reduced, isEcho ? 'echoing' : 'diving');
        const transition = stateMachine.begin(state as Exclude<CameraState, 'idle' | 'inside-memory'>);
        setCameraState(state);
        controls.enabled = false;
        await controls.setLookAt(
          target[0],
          target[1] + 0.04,
          target[2] + 4.15,
          target[0],
          target[1],
          target[2],
          true,
        );
        if (!cancelled && stateMachine.complete(transition.token, 'inside-memory')) {
          setCameraState('inside-memory');
        }
        return;
      }

      if (mode === 'universe' || mode === 'constellation') {
        let position = UNIVERSE_POSITION;
        let target = UNIVERSE_TARGET;
        let nextFocused = focusedMemoryId;
        let fallback: CameraState = 'navigating';

        if (priorMode === 'memory') {
          const restored = poseStack.pop();
          if (restored) {
            position = new Vector3(...restored.position);
            target = new Vector3(...restored.target);
            nextFocused = restored.focusedMemoryId;
          }
          fallback = 'returning';
        } else if (focusedMemoryId) {
          const focusedPosition = scenePositions?.[focusedMemoryId];
          if (focusedPosition) {
            position = new Vector3(
              focusedPosition[0],
              focusedPosition[1] + 0.4,
              focusedPosition[2] + 7.2,
            );
            target = new Vector3(...focusedPosition);
            fallback = 'focusing';
          }
        }

        const state = transitionState(reduced, fallback);
        previousMode.current = mode;
        previousActive.current = activeMemoryId;
        const transition = stateMachine.begin(state as Exclude<CameraState, 'idle' | 'inside-memory'>);
        setCameraState(state);
        controls.enabled = false;
        await controls.setLookAt(
          position.x,
          position.y,
          position.z,
          target.x,
          target.y,
          target.z,
          true,
        );
        if (!cancelled && stateMachine.complete(transition.token, 'idle')) {
          setCameraState('idle');
          controls.enabled = true;
          if (nextFocused !== focusedMemoryId && nextFocused) {
            useSceneStore.setState({ focusedMemoryId: nextFocused });
          }
        }
        return;
      }

      if (mode === 'entry') {
        previousMode.current = mode;
        previousActive.current = activeMemoryId;
        const transition = stateMachine.begin(transitionState(reduced, 'returning') as Exclude<CameraState, 'idle' | 'inside-memory'>);
        setCameraState(transition.state);
        controls.enabled = false;
        await controls.setLookAt(0, 0, 8, 0, 0, 0, true);
        if (!cancelled && stateMachine.complete(transition.token, 'idle')) setCameraState('idle');
      }
    };

    void run();
    return () => {
      cancelled = true;
      stateMachine.cancel(mode === 'memory' ? 'inside-memory' : 'idle');
      controls.stop();
    };
  }, [
    activeMemoryId,
    camera,
    controlsReady,
    focusedMemoryId,
    mode,
    motionSetting,
    scenePositions,
    setCameraState,
    view,
  ]);

  return (
    <DreiCameraControls
      ref={handleControls}
      makeDefault
      minDistance={3.5}
      maxDistance={28}
      minPolarAngle={Math.PI * 0.18}
      maxPolarAngle={Math.PI * 0.82}
      dollySpeed={0.45}
      truckSpeed={0.6}
      enabled={mode === 'universe' || mode === 'constellation'}
    />
  );
}
