import type { Memory } from '../domain/memory';
import type { Vec3 } from '../engine/layout/layoutTypes';

export type MemoryTemplateId = 'high-school' | 'love' | 'breakup' | 'university' | 'career';

export type TemplateLayoutId =
  | 'scattered'
  | 'orbit'
  | 'heart'
  | 'broken-heart'
  | 'galaxy'
  | 'helix'
  | 'mosaic'
  | 'tunnel'
  | 'ribbon'
  | 'cascade'
  | 'gravity'
  | 'deck'
  | 'wave'
  | 'spotlight'
  | 'sphere'
  | 'star'
  | 'torus'
  | 'prism';

export type TemplateCameraId =
  | 'wide'
  | 'approach'
  | 'dive'
  | 'track-left'
  | 'track-right'
  | 'top-down'
  | 'hero'
  | 'pullback';

export type TemplateMotionId =
  | 'assemble'
  | 'fly-through'
  | 'ribbon-sweep'
  | 'cascade'
  | 'carousel'
  | 'gallery-lock'
  | 'hero-reveal'
  | 'disperse'
  | 'gravity-drop'
  | 'deck-shuffle'
  | 'depth-bloom'
  | 'wave-drift'
  | 'wave-surface'
  | 'film-rail'
  | 'accordion-fold'
  | 'magnetic-swap'
  | 'spiral-lift'
  | 'helix-bloom'
  | 'galaxy-constellation'
  | 'gravity-assemble'
  | 'mosaic-lock'
  | 'rain-drop'
  | 'topdown-ripple'
  | 'galaxy-orbit'
  | 'reassemble'
  | 'photo-flip'
  | 'afterglow-wave'
  | 'vortex-drift'
  | 'prism-turn'
  | 'starburst-lane'
  | 'orbital-cross'
  | 'depth-surge'
  | 'gravity-sling'
  | 'ring-collapse'
  | 'ribbon-corkscrew'
  | 'wave-fold'
  | 'tunnel-shatter'
  | 'constellation-breathe'
  | 'magnetic-arc'
  | 'particle-lift'
  | 'spiral-shear'
  | 'orbital-swap'
  | 'cylinder-roll'
  | 'diagonal-sweep'
  | 'blackhole-gather'
  | 'sphere-pulse'
  | 'star-ignite'
  | 'torus-spin'
  | 'prism-fold'
  | 'farewell-particle-gather';

export type PlaybackStatus = 'idle' | 'preview' | 'playing' | 'paused' | 'completed' | 'error';

export type MotionCueKind = 'cut' | 'reveal' | 'focus' | 'cluster' | 'chapter' | 'accent' | 'farewell';

export interface MotionCue {
  /** Absolute seconds from the beginning of the selected song range. */
  time: number;
  kind: MotionCueKind;
  strength: 0 | 1 | 2;
  targetIds?: string[];
  label?: string;
}

export interface TemplateTransform {
  position: Vec3;
  rotation: Vec3;
  scale: number;
  opacity: number;
}

export interface TimelinePhase {
  id: string;
  start: number;
  end: number;
  layout: TemplateLayoutId;
  label: string;
  camera: TemplateCameraId;
  motion?: TemplateMotionId;
  easing?: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'cinematic' | 'expo-out';
  heroPhotoRole?: 'first' | 'middle' | 'last';
  visibleCount?: number;
  photoOffset?: number;
  stagger?: number;
  settleAt?: number;
}

export interface TemplateSessionOverrides {
  photoIds?: string[];
  heroPhotoId?: string;
  photoOrder?: string[];
  phaseOverrides?: Partial<Record<string, Partial<TimelinePhase>>>;
  layoutPreset?: TemplateLayoutId;
  cameraPreset?: string;
  songCueMap?: Record<string, number>;
}

export interface MemoryTemplateConfig {
  id: MemoryTemplateId;
  title: string;
  category: string;
  description: string;
  durationSeconds: number;
  available: boolean;
  layout: TemplateLayoutId;
  seed: number;
  phases: readonly TimelinePhase[];
  minPhotos: number;
  maxPhotos: number;
  motionCues?: readonly MotionCue[];
}

export interface MemoryTemplateSession {
  templateId: MemoryTemplateId;
  source: 'demo' | 'personal';
  memoryIds: string[];
  heroPhotoId: string | null;
  status: PlaybackStatus;
  progress: number;
  startedAt: number | null;
  error: string | null;
  overrides?: TemplateSessionOverrides;
}

export type PhotoLifecycleStage = 'entering' | 'stable' | 'exiting' | 'retained' | 'released';

export interface PhotoLifecycleState {
  stage: PhotoLifecycleStage;
  /** Normalized progress through this lifecycle stage. */
  progress: number;
  /** True only after the deterministic exit grace window has elapsed. */
  removable: boolean;
}

export interface TemplatePhotoState {
  memory: Memory;
  transform: TemplateTransform;
  emphasis: 'quiet' | 'related' | 'hero';
  lifecycle: PhotoLifecycleState;
  /** Whether the card belongs to a photo-built volume and should keep its authored normal. */
  surface?: 'plane' | 'geometric';
}

export interface TimelineState {
  progress: number;
  phase: TimelinePhase;
  photos: TemplatePhotoState[];
  camera: { position: Vec3; target: Vec3; fov: number };
}
