import { Canvas } from '@react-three/fiber';
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

import { useSceneStore } from '../stores/sceneStore';
import { useSettingsStore } from '../stores/settingsStore';
import { CameraRig } from './CameraRig';
import { localTextureManager } from './textures/LocalTextureManager';
import { UniverseScene } from './UniverseScene';
import { detectWebGLSupport } from './webglSupport';

const DEMO_FALLBACK_PHOTOS = Array.from({ length: 96 }, (_, index) => {
  const number = String(index + 1).padStart(3, '0');
  return {
    id: `demo-memory-${number}`,
    title: `演示照片 ${String(index + 1)}`,
    src: `${import.meta.env.BASE_URL}demo/photos/thumbnail/memory-${number}.jpg`,
  };
});

function SceneTextureLifecycle(): ReactNode {
  const source = useSceneStore((state) => state.source);
  useEffect(() => () => localTextureManager.clear(), [source]);
  return null;
}

function DemoPhotoFallback(): ReactNode {
  const source = useSceneStore((state) => state.source);
  const dataset = useSceneStore((state) => state.dataset);
  const requestMemory = useSceneStore((state) => state.requestMemory);

  if (source !== 'demo') {
    return (
      <div className="webgl-fallback" role="status">
        <p>当前浏览器无法显示记忆空间。你仍可从“记忆档案”管理本地数据。</p>
        <a className="secondary-action" href="/archive?source=personal">
          打开记忆档案
        </a>
      </div>
    );
  }

  const photos = dataset?.memories.length
    ? dataset.memories.map((memory) => ({ id: memory.id, title: memory.title, src: memory.assetKeys.thumbnail }))
    : DEMO_FALLBACK_PHOTOS;

  return (
    <section className="demo-scene-fallback" aria-label="演示宇宙照片兼容浏览模式">
      <div className="demo-scene-fallback__heading">
        <span>演示宇宙 · 兼容浏览模式</span>
        <strong>那年夏天</strong>
        <small>96 张照片 · 图片已内置，不依赖本地档案或第三方登录</small>
      </div>
      <div className="demo-scene-fallback__grid">
        {photos.map((photo, index) => (
          <button
            className="demo-scene-fallback__photo"
            key={photo.id}
            type="button"
            style={{ '--demo-fallback-tilt': `${String(((index % 5) - 2) * 0.7)}deg` } as CSSProperties}
            aria-label={`打开演示照片：${photo.title}`}
            onClick={() => requestMemory(photo.id)}
          >
            <img
              src={photo.src}
              alt={photo.title}
              decoding="async"
              loading={index < 18 ? 'eager' : 'lazy'}
            />
          </button>
        ))}
      </div>
    </section>
  );
}

function WebGLFallback(): ReactNode {
  return (
    <DemoPhotoFallback />
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
          <CameraRig />
          <UniverseScene />
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
