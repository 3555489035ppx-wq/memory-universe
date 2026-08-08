import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, type ReactNode } from 'react';
import { AdditiveBlending, Color } from 'three';
import type { Group, Points, PointsMaterial, ShaderMaterial } from 'three';

import { useSceneStore, type SceneMode } from '../stores/sceneStore';
import { useMemoryTemplateStore } from '../stores/memoryTemplateStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useMusicStore } from '../stores/musicStore';
import { MemoryLODRenderer } from './MemoryLODRenderer';
import { PerformanceGovernor } from './PerformanceGovernor';
import { RelationshipLines } from './RelationshipLines';
import { MemoryTemplateLayer } from '../memory/scene/MemoryTemplateLayer';

function spatialDust(count: number): Float32Array {
  const result = new Float32Array(count * 3);
  let seed = 7_991;
  for (let index = 0; index < count; index += 1) {
    seed = (seed * 48_271) % 2_147_483_647;
    const radius = 5 + (seed / 2_147_483_647) * 15;
    seed = (seed * 48_271) % 2_147_483_647;
    const angle = (seed / 2_147_483_647) * Math.PI * 2;
    seed = (seed * 48_271) % 2_147_483_647;
    const offset = index * 3;
    result[offset] = Math.cos(angle) * radius;
    result[offset + 1] = (seed / 2_147_483_647 - 0.5) * 11;
    result[offset + 2] = Math.sin(angle) * radius - 4;
  }
  return result;
}

interface StarfieldData {
  positions: Float32Array;
  scales: Float32Array;
  phases: Float32Array;
}

function starfieldData(
  count: number,
  seedStart: number,
  width = 40,
  height = 25,
  depth = 29,
): StarfieldData {
  const positions = new Float32Array(count * 3);
  const scales = new Float32Array(count);
  const phases = new Float32Array(count);
  let seed = seedStart;
  for (let index = 0; index < count; index += 1) {
    seed = (seed * 48_271) % 2_147_483_647;
    const x = (seed / 2_147_483_647 - 0.5) * width;
    seed = (seed * 48_271) % 2_147_483_647;
    const y = (seed / 2_147_483_647 - 0.5) * height;
    seed = (seed * 48_271) % 2_147_483_647;
    const z = -3 - (seed / 2_147_483_647) * depth;
    const offset = index * 3;
    positions[offset] = x;
    positions[offset + 1] = y;
    positions[offset + 2] = z;
    seed = (seed * 48_271) % 2_147_483_647;
    scales[index] = 0.72 + (seed / 2_147_483_647) * 1.05;
    seed = (seed * 48_271) % 2_147_483_647;
    phases[index] = seed / 2_147_483_647;
  }
  return { positions, scales, phases };
}

function sphericalStarfieldData(
  count: number,
  seedStart: number,
  radiusMin = 26,
  radiusMax = 44,
  centerZ = -18,
): StarfieldData {
  const positions = new Float32Array(count * 3);
  const scales = new Float32Array(count);
  const phases = new Float32Array(count);
  let seed = seedStart;
  for (let index = 0; index < count; index += 1) {
    seed = (seed * 48_271) % 2_147_483_647;
    const theta = (seed / 2_147_483_647) * Math.PI * 2;
    seed = (seed * 48_271) % 2_147_483_647;
    const latitude = (seed / 2_147_483_647) * 2 - 1;
    seed = (seed * 48_271) % 2_147_483_647;
    const radius = radiusMin + (seed / 2_147_483_647) * (radiusMax - radiusMin);
    const radial = Math.sqrt(Math.max(0, 1 - latitude * latitude));
    const offset = index * 3;
    positions[offset] = Math.cos(theta) * radial * radius;
    positions[offset + 1] = latitude * radius * 0.78;
    positions[offset + 2] = centerZ + Math.sin(theta) * radial * radius;
    seed = (seed * 48_271) % 2_147_483_647;
    scales[index] = 0.62 + (seed / 2_147_483_647) * 1.2;
    seed = (seed * 48_271) % 2_147_483_647;
    phases[index] = seed / 2_147_483_647;
  }
  return { positions, scales, phases };
}

function StarLayer({
  data,
  color,
  pointSize,
  opacity,
}: {
  data: StarfieldData;
  color: string;
  pointSize: number;
  opacity: number;
}): ReactNode {
  const material = useRef<ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uColor: { value: new Color(color) },
      uOpacity: { value: opacity },
      uPointSize: { value: pointSize },
      uPixelRatio: { value: 1 },
      uTime: { value: 0 },
    }),
    [color, opacity, pointSize],
  );
  useFrame((state) => {
    if (!material.current) return;
    const { energy, beat } = useMusicStore.getState();
    const currentUniforms = material.current.uniforms;
    const timeUniform = currentUniforms.uTime;
    const pixelRatioUniform = currentUniforms.uPixelRatio;
    const opacityUniform = currentUniforms.uOpacity;
    const pointSizeUniform = currentUniforms.uPointSize;
    if (!timeUniform || !pixelRatioUniform || !opacityUniform || !pointSizeUniform) return;
    timeUniform.value = state.clock.elapsedTime;
    pixelRatioUniform.value = state.gl.getPixelRatio();
    opacityUniform.value = opacity + energy * 0.12 + beat * 0.1;
    pointSizeUniform.value = pointSize * (1 + energy * 0.12 + beat * 0.08);
  });
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[data.positions, 3]} />
        <bufferAttribute attach="attributes-aScale" args={[data.scales, 1]} />
        <bufferAttribute attach="attributes-aPhase" args={[data.phases, 1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={material}
        blending={AdditiveBlending}
        depthWrite={false}
        fragmentShader={STAR_FRAGMENT_SHADER}
        uniforms={uniforms}
        transparent
        vertexShader={STAR_VERTEX_SHADER}
      />
    </points>
  );
}

const STAR_VERTEX_SHADER = `
  attribute float aScale;
  attribute float aPhase;
  uniform float uPixelRatio;
  uniform float uPointSize;
  varying float vPhase;

  void main() {
    vPhase = aPhase;
    vec4 modelPosition = modelMatrix * vec4(position, 1.0);
    vec4 viewPosition = viewMatrix * modelPosition;
    gl_Position = projectionMatrix * viewPosition;
    gl_PointSize = min(
      14.0,
      max(1.0, uPointSize * aScale * uPixelRatio * (118.0 / max(1.0, -viewPosition.z)))
    );
  }
`;

const STAR_FRAGMENT_SHADER = `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uTime;
  varying float vPhase;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float distanceToCenter = length(uv);
    float core = smoothstep(0.2, 0.0, distanceToCenter);
    float halo = smoothstep(0.5, 0.08, distanceToCenter);
    float beamX = exp(-pow(abs(uv.x) * 22.0, 2.0)) * smoothstep(0.48, 0.04, abs(uv.y));
    float beamY = exp(-pow(abs(uv.y) * 22.0, 2.0)) * smoothstep(0.48, 0.04, abs(uv.x));
    float twinkle = 0.78 + 0.22 * sin(uTime * (1.4 + vPhase * 1.6) + vPhase * 6.28318);
    float alpha = (core * 1.0 + halo * 0.045 + (beamX + beamY) * 0.08) * uOpacity * twinkle;
    if (alpha < 0.012) discard;
    vec3 starColor = mix(uColor, vec3(1.0), core * 0.72);
    gl_FragColor = vec4(starColor, alpha);
  }
`;

function RotatingStarfield({ mode }: { mode: SceneMode }): ReactNode {
  const group = useRef<Group>(null);
  const quality = useSettingsStore((state) => state.effectiveQuality);
  const layers = useMemo(() => {
    const count = quality === 'low' ? 2_200 : quality === 'high' ? 5_200 : 3_800;
    const brightCount = quality === 'low' ? 520 : quality === 'high' ? 1_200 : 880;
    const shellCount = quality === 'low' ? 1_800 : quality === 'high' ? 3_600 : 2_600;
    const skyCount = quality === 'low' ? 2_400 : quality === 'high' ? 5_600 : 4_200;
    const backdropCount = quality === 'low' ? 2_400 : quality === 'high' ? 5_800 : 4_200;
    const backdropBrightCount = quality === 'low' ? 500 : quality === 'high' ? 1_200 : 900;
    return {
      dim: starfieldData(count, 31_041, 76, 48, 58),
      bright: starfieldData(brightCount, 84_113, 68, 44, 52),
      shell: sphericalStarfieldData(shellCount, 71_209, 20, 58),
      sky: sphericalStarfieldData(skyCount, 90_017, 46, 74, -5),
      backdrop: starfieldData(backdropCount, 62_481, 54, 34, 20),
      backdropBright: starfieldData(backdropBrightCount, 19_733, 52, 32, 18),
    };
  }, [quality]);

  useFrame((state, delta) => {
    if (!group.current) return;
    const { energy, beat } = useMusicStore.getState();
    const modeMultiplier = mode === 'entry' ? 4.2 : mode === 'covered' ? 3.2 : 3.5;
    group.current.rotation.y += delta * (0.02 + energy * 0.028) * modeMultiplier;
    group.current.rotation.z += delta * (0.004 + beat * 0.008) * modeMultiplier;
    group.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.035) * 0.02;
  });

  const coveredBoost = mode === 'covered';
  const entryBoost = mode === 'entry';

  return (
    <>
      <group position={[0, 0, -5]}>
        <StarLayer data={layers.backdrop} color="#9eb9d8" pointSize={0.72} opacity={0.92} />
        <StarLayer data={layers.backdropBright} color="#f2f7ff" pointSize={1.08} opacity={1.12} />
      </group>
      <group position={[0, 0, 0]}>
        <StarLayer
          data={layers.sky}
          color={coveredBoost || entryBoost ? '#b9d7f5' : '#7394b8'}
          pointSize={coveredBoost ? 0.86 : entryBoost ? 0.82 : 0.72}
          opacity={coveredBoost ? 1.16 : entryBoost ? 1.08 : 0.94}
        />
      </group>
      <group ref={group} position={[0, 0, -1]}>
        <StarLayer
          data={layers.dim}
          color={coveredBoost || entryBoost ? '#c7d8e8' : '#91abc8'}
          pointSize={coveredBoost ? 0.86 : entryBoost ? 0.72 : 0.66}
          opacity={coveredBoost ? 1.26 : entryBoost ? 1.06 : 0.92}
        />
        <StarLayer
          data={layers.bright}
          color={coveredBoost ? '#ffffff' : '#eef7ff'}
          pointSize={coveredBoost ? 1.22 : entryBoost ? 1.12 : 1.02}
          opacity={coveredBoost ? 1.36 : entryBoost ? 1.24 : 1.16}
        />
        <StarLayer data={layers.shell} color="#7899bb" pointSize={0.7} opacity={0.9} />
      </group>
    </>
  );
}

function SpatialDust(): ReactNode {
  const points = useRef<Points>(null);
  const material = useRef<PointsMaterial>(null);
  const quality = useSettingsStore((state) => state.effectiveQuality);
  const positions = useMemo(
    () => spatialDust(quality === 'low' ? 34 : quality === 'high' ? 110 : 72),
    [quality],
  );
  useFrame((state, delta) => {
    const { energy, beat } = useMusicStore.getState();
    if (points.current) {
      points.current.rotation.y += delta * (0.0025 + energy * 0.008);
      points.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.05) * energy * 0.015;
    }
    if (material.current) {
      material.current.opacity = 0.18 + energy * 0.18 + beat * 0.12;
      material.current.size = 0.018 + energy * 0.008 + beat * 0.006;
    }
  });
  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        ref={material}
        color="#9db1c2"
        size={0.02}
        opacity={0.22}
        transparent
        sizeAttenuation
      />
    </points>
  );
}

export function UniverseScene(): ReactNode {
  const mode = useSceneStore((state) => state.mode);
  const templateSession = useMemoryTemplateStore((state) => state.session);
  const templateActive = templateSession !== null && templateSession.status !== 'error';

  return (
    <>
      <fog attach="fog" args={['#05080f', 18, 48]} />
      <RotatingStarfield mode={mode} />
      {mode !== 'entry' && mode !== 'covered' ? (
        <>
          <SpatialDust />
          <RelationshipLines />
          {!templateActive && <MemoryLODRenderer />}
          {templateActive && <MemoryTemplateLayer />}
          <PerformanceGovernor />
        </>
      ) : null}
    </>
  );
}
