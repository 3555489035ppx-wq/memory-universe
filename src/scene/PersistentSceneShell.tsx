import { Canvas } from '@react-three/fiber';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import { useSceneStore } from '../stores/sceneStore';
import { useSettingsStore } from '../stores/settingsStore';
import { CameraRig } from './CameraRig';
import { localTextureManager } from './textures/LocalTextureManager';
import { UniverseScene } from './UniverseScene';
import { detectWebGLSupport } from './webglSupport';

function SceneTextureLifecycle(): ReactNode {
  const source = useSceneStore((state) => state.source);
  useEffect(() => () => localTextureManager.clear(), [source]);
  return null;
}

function WebGLFallback(): ReactNode {
  return (
    <div className="webgl-fallback" role="status">
      <p>当前浏览器无法显示记忆空间。你仍可从“记忆档案”管理本地数据。</p>
      <a className="secondary-action" href="/archive?source=personal">
        打开记忆档案
      </a>
    </div>
  );
}

export function PersistentSceneShell(): ReactNode {
  const quality = useSettingsStore((state) => state.effectiveQuality);
  const clearFocus = useSceneStore((state) => state.clearFocus);
  const [webglAvailable] = useState(detectWebGLSupport);
  const [canvasEpoch, setCanvasEpoch] = useState(0);
  const [contextLost, setContextLost] = useState(false);
  const listenersRef = useRef<{
    canvas: HTMLCanvasElement;
    onLost: (event: Event) => void;
    onRestored: () => void;
  } | null>(null);
  const handleCreated = useCallback(({ gl }: { gl: { domElement: HTMLCanvasElement } }) => {
    listenersRef.current?.canvas.removeEventListener(
      'webglcontextlost',
      listenersRef.current.onLost,
    );
    listenersRef.current?.canvas.removeEventListener(
      'webglcontextrestored',
      listenersRef.current.onRestored,
    );
    const canvas = gl.domElement;
    const onLost = (event: Event): void => {
      event.preventDefault();
      setContextLost(true);
    };
    const onRestored = (): void => {
      setContextLost(false);
    };
    canvas.addEventListener('webglcontextlost', onLost, { passive: false });
    canvas.addEventListener('webglcontextrestored', onRestored);
    listenersRef.current = { canvas, onLost, onRestored };
  }, []);

  useEffect(
    () => () => {
      const listeners = listenersRef.current;
      listeners?.canvas.removeEventListener('webglcontextlost', listeners.onLost);
      listeners?.canvas.removeEventListener('webglcontextrestored', listeners.onRestored);
      listenersRef.current = null;
    },
    [],
  );

  return (
    <div className="scene-shell" data-testid="persistent-scene-shell">
      {webglAvailable ? (
        <Canvas
          aria-hidden="true"
          key={canvasEpoch}
          camera={{ position: [0, 0, 8], fov: 52, near: 0.1, far: 120 }}
          dpr={quality === 'low' ? 1 : quality === 'high' ? [1, 2] : [1, 1.5]}
          fallback={<WebGLFallback />}
          gl={{ antialias: quality !== 'low', alpha: true, powerPreference: 'high-performance' }}
          onCreated={handleCreated}
          onPointerMissed={clearFocus}
        >
          <UniverseScene />
          <CameraRig />
          <SceneTextureLifecycle />
        </Canvas>
      ) : (
        <WebGLFallback />
      )}
      {webglAvailable && contextLost && (
        <div className="webgl-fallback" role="status">
          <p>记忆空间的图形上下文暂时中断，已保留本地数据。</p>
          <button
            className="secondary-action"
            type="button"
            onClick={() => {
              setContextLost(false);
              setCanvasEpoch((epoch) => epoch + 1);
            }}
          >
            重新连接记忆空间
          </button>
        </div>
      )}
    </div>
  );
}
