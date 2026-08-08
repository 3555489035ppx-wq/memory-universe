import type { Memory } from '../domain/memory';
import type { Vec3 } from '../engine/layout/layoutTypes';

export type MemoryTemplateId = 'high-school' | 'love' | 'breakup' | 'university' | 'career';

export type TemplateLayoutId =
  | 'scattered'
  | 'orbit'
  | 'heart'
  | 'broken-heart'
  | 'galaxy'
  | 'helix';

export type PlaybackStatus = 'idle' | 'preview' | 'playing' | 'paused' | 'completed' | 'error';

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
  camera: 'wide' | 'approach' | 'hero' | 'pullback';
  easing?: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
  heroPhotoRole?: 'first' | 'middle' | 'last';
  visibleCount?: number;
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

export interface TemplatePhotoState {
  memory: Memory;
  transform: TemplateTransform;
  emphasis: 'quiet' | 'related' | 'hero';
}

export interface TimelineState {
  progress: number;
  phase: TimelinePhase;
  photos: TemplatePhotoState[];
  camera: { position: Vec3; target: Vec3; fov: number };
}
