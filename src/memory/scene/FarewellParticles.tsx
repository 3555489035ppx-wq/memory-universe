import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import type { Points, PointsMaterial } from 'three';

import type { Memory } from '../../domain/memory';
import type { EffectiveQuality } from '../../stores/settingsStore';
import type { TemplateTransform } from '../types';
import { evaluateFarewellSequence, type FarewellSequenceState } from '../engine/FarewellSequence';
import { createFarewellTextTargets, farewellParticleBurst } from '../engine/FarewellParticleLayout';
import { dimensions } from '../layouts/shared';

interface FarewellParticlesProps {
  memories: readonly Memory[];
  layout: Readonly<Record<string, TemplateTransform>>;
  quality: EffectiveQuality;
  reducedMotion: boolean;
  seed: number;
  durationSeconds: number;
  resolveState: () => FarewellSequenceState;
}

const PARTICLE_COUNTS: Record<EffectiveQuality, number> = {
  low: 420,
  medium: 1_350,
  high: 2_400,
};

interface ParticleBuffers {
  positions: Float32Array;
  origins: Float32Array;
  targets: Float32Array;
  textTargets: Float32Array;
  bursts: Float32Array;
  drift: Float32Array;
  delays: Float32Array;
  colors: Float32Array;
}

function unit(index: number, salt: number): number {
  const value = Math.sin(index * 91.731 + salt * 17.137) * 43_758.545_312_3;
  return value - Math.floor(value);
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function smoothstep(value: number): number {
  const clamped = clamp01(value);
  return clamped * clamped * (3 - 2 * clamped);
}

export function FarewellParticles({
  memories,
  layout,
  quality,
  reducedMotion,
  seed,
  durationSeconds,
  resolveState,
}: FarewellParticlesProps): ReactNode {
  const count = reducedMotion ? Math.min(320, PARTICLE_COUNTS[quality]) : PARTICLE_COUNTS[quality];
  const points = useRef<Points>(null);
  const material = useRef<PointsMaterial>(null);
  const particleClock = useRef(0);
  const positionBuffer = useRef<Float32Array>(new Float32Array(0));
  const buffers = useMemo<ParticleBuffers>(() => {
    const positions = new Float32Array(count * 3);
    const origins = new Float32Array(count * 3);
    const targets = new Float32Array(count * 3);
    const textTargets = createFarewellTextTargets(count, seed);
    const bursts = new Float32Array(count * 3);
    const drift = new Float32Array(count * 3);
    const delays = new Float32Array(count);
    const colors = new Float32Array(count * 3);

    for (let index = 0; index < count; index += 1) {
      const memory = memories[index % Math.max(1, memories.length)];
      const transform = memory ? layout[memory.id] : undefined;
      const [planeWidth, planeHeight] = memory ? dimensions(memory) : [1, 1];
      const angle = unit(index, seed + 3) * Math.PI * 2;
      const edge = unit(index, seed + 7) > 0.5;
      const width = planeWidth * (transform?.scale ?? 0.8);
      const height = planeHeight * (transform?.scale ?? 0.8);
      const originX = (transform?.position[0] ?? 0)
        + (edge ? Math.sign(Math.cos(angle) || 1) * width * 0.5 : Math.cos(angle) * width * 0.5);
      const originY = (transform?.position[1] ?? 0)
        + (edge ? Math.sin(angle) * height * 0.5 : Math.sign(Math.sin(angle) || 1) * height * 0.5);
      const originZ = (transform?.position[2] ?? -0.6) + (unit(index, seed + 11) - 0.5) * 0.16;
      const targetAngle = unit(index, seed + 13) * Math.PI * 2;
      const targetRadius = 0.18 + unit(index, seed + 17) * 1.2;
      const offset = index * 3;
      origins[offset] = positions[offset] = originX;
      origins[offset + 1] = positions[offset + 1] = originY;
      origins[offset + 2] = positions[offset + 2] = originZ;
      targets[offset] = Math.cos(targetAngle) * targetRadius;
      targets[offset + 1] = Math.sin(targetAngle) * targetRadius * 0.58;
      targets[offset + 2] = 0.2 + (unit(index, seed + 19) - 0.5) * 1.3;
      const burst = farewellParticleBurst(index, seed);
      bursts[offset] = burst[0];
      bursts[offset + 1] = burst[1];
      bursts[offset + 2] = burst[2];
      drift[offset] = Math.cos(angle) * (0.28 + unit(index, seed + 23) * 0.62);
      drift[offset + 1] = Math.sin(angle) * (0.2 + unit(index, seed + 29) * 0.48);
      drift[offset + 2] = (unit(index, seed + 31) - 0.5) * 0.82;
      delays[index] = unit(index, seed + 37) * 0.58;

      const rgb = memory?.dominantColor.rgb ?? [150, 160, 170];
      const average = (rgb[0] + rgb[1] + rgb[2]) / 3;
      // Preserve each memory's colour identity but lift the floor. Dark
      // dominant colours were technically present in the previous version,
      // yet the copy disappeared against the starfield at recording size.
      colors[offset] = Math.min(1, Math.max(0.42, (rgb[0] * 0.58 + average * 0.42) / 255 * 0.76 + 0.24));
      colors[offset + 1] = Math.min(1, Math.max(0.46, (rgb[1] * 0.58 + average * 0.42) / 255 * 0.76 + 0.24));
      colors[offset + 2] = Math.min(1, Math.max(0.5, (rgb[2] * 0.58 + average * 0.42) / 255 * 0.76 + 0.24));
    }

    return { positions, origins, targets, textTargets, bursts, drift, delays, colors };
  }, [count, layout, memories, seed]);

  // Three owns this attribute after mount. Keep its mutable frame buffer in a
  // ref so React's memoized scene description remains immutable.
  useLayoutEffect(() => {
    positionBuffer.current = buffers.positions;
  }, [buffers]);

  useFrame((_, delta) => {
    if (!points.current || !material.current) return;
    const positions = positionBuffer.current;
    if (positions.length !== count * 3) return;
    const rawState = resolveState();
    const rawTime = rawState.localTime;
    const timeDelta = rawTime - particleClock.current;
    const visualStep = Math.min(1 / 30, Math.max(0, Number.isFinite(delta) ? delta * 1.5 : 0));
    // Keep particle positions continuous across a dropped render frame. A
    // large discontinuity is treated as an intentional seek (for example the
    // preview slider), not slowly replayed from the old location.
    if (!Number.isFinite(timeDelta) || Math.abs(timeDelta) > 0.45) {
      particleClock.current = rawTime;
    } else {
      particleClock.current += Math.min(visualStep, Math.max(-visualStep, timeDelta));
    }
    const state = evaluateFarewellSequence(particleClock.current, durationSeconds, reducedMotion);
    points.current.visible = state.active && state.particleOpacity > 0.002;
    if (!points.current.visible) return;

    const gather = state.particleGather;
    const textGather = state.particleTextOpacity;
    const explosion = state.particleExplosion;
    const dissolveTime = Math.max(0, state.localTime - 0.95);
    for (let index = 0; index < count; index += 1) {
      const offset = index * 3;
      const release = smoothstep((dissolveTime - (buffers.delays[index] ?? 0)) / 1.35);
      const sourceX = (buffers.origins[offset] ?? 0) + (buffers.drift[offset] ?? 0) * release;
      const sourceY = (buffers.origins[offset + 1] ?? 0) + (buffers.drift[offset + 1] ?? 0) * release;
      const sourceZ = (buffers.origins[offset + 2] ?? 0) + (buffers.drift[offset + 2] ?? 0) * release;
      const orbit = state.localTime * (0.08 + unit(index, seed + 41) * 0.05);
      const targetX = (buffers.targets[offset] ?? 0) + Math.cos(orbit + index * 0.07) * 0.08;
      const targetY = (buffers.targets[offset + 1] ?? 0) + Math.sin(orbit + index * 0.05) * 0.05;
      const targetZ = buffers.targets[offset + 2] ?? 0;
      const gatheredX = sourceX + (targetX - sourceX) * gather;
      const gatheredY = sourceY + (targetY - sourceY) * gather;
      const gatheredZ = sourceZ + (targetZ - sourceZ) * gather;
      const textX = gatheredX + ((buffers.textTargets[offset] ?? gatheredX) - gatheredX) * textGather;
      const textY = gatheredY + ((buffers.textTargets[offset + 1] ?? gatheredY) - gatheredY) * textGather;
      const textZ = gatheredZ + ((buffers.textTargets[offset + 2] ?? gatheredZ) - gatheredZ) * textGather;
      positions[offset] = textX + (buffers.bursts[offset] ?? 0) * explosion;
      positions[offset + 1] = textY + (buffers.bursts[offset + 1] ?? 0) * explosion;
      positions[offset + 2] = textZ + (buffers.bursts[offset + 2] ?? 0) * explosion;
    }

    const attribute = points.current.geometry.getAttribute('position');
    attribute.needsUpdate = true;
    // A small lift while the copy is assembled gives the particle typography
    // a readable centre without introducing a solid text overlay. It then
    // returns naturally to the starfield as the burst begins.
    material.current.opacity = Math.min(
      0.98,
      state.particleOpacity + state.particleTextOpacity * (reducedMotion ? 0.18 : 0.38),
    );
    const baseSize = reducedMotion ? 0.028 : quality === 'high' ? 0.04 : 0.036;
    material.current.size = baseSize * (1 + state.particleTextOpacity * 0.48);
    points.current.rotation.z = 0;
  });

  return (
    <points ref={points} visible={false} frustumCulled={false} renderOrder={48}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[buffers.positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[buffers.colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        ref={material}
        vertexColors
        transparent
        opacity={0}
        size={0.04}
        sizeAttenuation
        depthWrite={false}
        toneMapped={false}
      />
    </points>
  );
}
