import type { Memory } from '../../domain/memory';
import { getAsset } from '../../data/repositories/memoryRepository';
import type { Vec3 } from '../../engine/layout/layoutTypes';
import { layoutEngine } from '../../memory/engine/LayoutEngine';
import { composePhaseLayouts } from '../../memory/engine/composePhaseLayouts';
import { evaluateFarewellSequence, type FarewellSequenceState } from '../../memory/engine/FarewellSequence';
import { createFarewellTextTargets, farewellParticleBurst } from '../../memory/engine/FarewellParticleLayout';
import { evaluateTemplateState, type TimelineContext } from '../../memory/engine/TimelineEngine';
import { dimensions } from '../../memory/layouts/shared';
import type { MemoryTemplateConfig, TemplatePhotoState } from '../../memory/types';

import { projectWorldPoint, projectedLength, type ProjectedPoint } from './frameProjection';

export interface ExportPhotoSourceAudit {
  memoryId: string;
  assetKey: string | null;
  width: number;
  height: number;
  /** A full-screen portrait frame can retain native 4K image detail. */
  has4kSourceDetail: boolean;
}

export interface ExportSourceAudit {
  loadedPhotoCount: number;
  fallbackPhotoCount: number;
  photoSources: readonly ExportPhotoSourceAudit[];
}

export interface MemoryFilmFrameRendererOptions {
  canvas: HTMLCanvasElement;
  config: MemoryTemplateConfig;
  memories: readonly Memory[];
  heroPhotoId: string | null;
  reducedMotion?: boolean;
  signal?: AbortSignal;
  onPreparationProgress?: (completed: number, total: number, label: string) => void;
}

export interface RenderedFilmFrame {
  progress: number;
  phaseId: string;
  farewell: FarewellSequenceState;
}

interface LoadedFrameImage {
  source: CanvasImageSource | null;
  width: number;
  height: number;
  assetKey: string | null;
  close: () => void;
}

interface RenderedPhoto {
  photo: TemplatePhotoState;
  projection: ProjectedPoint;
  width: number;
  height: number;
}

interface Star {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  drift: number;
}

// The export is a scene-only render, so the star field must survive a dark
// phone frame and a later mobile-app transcode. A few dozen dots disappear in
// compression; this density keeps the sky readable without changing photo
// framing or adding UI chrome to the movie.
const STAR_COUNT = 520;
const EXPORT_PARTICLE_COUNT = 760;
const REDUCED_EXPORT_PARTICLE_COUNT = 180;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function smoothstep(value: number): number {
  const safe = clamp01(value);
  return safe * safe * (3 - 2 * safe);
}

function seededUnit(index: number, seed: number): number {
  const value = Math.sin(index * 91.731 + seed * 17.137) * 43_758.545_312_3;
  return value - Math.floor(value);
}

function isRemoteOrPublicAssetKey(key: string): boolean {
  return key.startsWith('/') || key.startsWith('data:') || key.startsWith('blob:') || /^https?:\/\//u.test(key);
}

function abortIfNeeded(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('Video export cancelled.', 'AbortError');
}

function createStars(seed: number): Star[] {
  return Array.from({ length: STAR_COUNT }, (_, index) => ({
    x: seededUnit(index, seed + 13),
    y: seededUnit(index, seed + 29),
    radius: 0.45 + seededUnit(index, seed + 37) * 1.55,
    alpha: 0.14 + seededUnit(index, seed + 43) * 0.38,
    drift: seededUnit(index, seed + 53) * Math.PI * 2,
  }));
}

async function blobForAssetKey(key: string, signal?: AbortSignal): Promise<Blob | null> {
  abortIfNeeded(signal);
  try {
    if (isRemoteOrPublicAssetKey(key)) {
      const response = await fetch(key, { cache: 'force-cache', ...(signal ? { signal } : {}) });
      if (!response.ok) return null;
      return await response.blob();
    }
    return (await getAsset(key))?.blob ?? null;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    return null;
  }
}

async function imageFromBlob(blob: Blob, signal?: AbortSignal): Promise<LoadedFrameImage | null> {
  abortIfNeeded(signal);
  if (typeof createImageBitmap === 'function') {
    try {
      const image = await createImageBitmap(blob);
      abortIfNeeded(signal);
      return {
        source: image,
        width: image.width,
        height: image.height,
        assetKey: null,
        close: () => image.close(),
      };
    } catch {
      // Some browser decoders reject a particular image type. The HTML image fallback below is still usable.
    }
  }
  if (typeof Image === 'undefined') return null;
  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.decoding = 'async';
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('IMAGE_DECODE_FAILED'));
      element.src = objectUrl;
    });
    abortIfNeeded(signal);
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      assetKey: null,
      close: () => undefined,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function loadMemoryImage(memory: Memory, signal?: AbortSignal): Promise<LoadedFrameImage> {
  const keys = [memory.assetKeys.original, memory.assetKeys.preview, memory.assetKeys.thumbnail]
    .filter((key): key is string => Boolean(key));
  for (const key of keys) {
    const blob = await blobForAssetKey(key, signal);
    if (!blob) continue;
    const loaded = await imageFromBlob(blob, signal);
    if (loaded?.source) return { ...loaded, assetKey: key };
  }
  return {
    source: null,
    width: Math.max(1, memory.width),
    height: Math.max(1, memory.height),
    assetKey: null,
    close: () => undefined,
  };
}

function drawImageCover(
  context: CanvasRenderingContext2D,
  image: CanvasImageSource,
  imageWidth: number,
  imageHeight: number,
  width: number,
  height: number,
): void {
  const sourceWidth = Math.max(1, imageWidth);
  const sourceHeight = Math.max(1, imageHeight);
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const drawnWidth = sourceWidth * scale;
  const drawnHeight = sourceHeight * scale;
  context.drawImage(image, (width - drawnWidth) / 2, (height - drawnHeight) / 2, drawnWidth, drawnHeight);
}

function rgba(memory: Memory, alpha: number): string {
  const [red, green, blue] = memory.dominantColor.rgb;
  return `rgba(${String(red)}, ${String(green)}, ${String(blue)}, ${String(alpha)})`;
}

function drawFallbackPhoto(
  context: CanvasRenderingContext2D,
  memory: Memory,
  width: number,
  height: number,
): void {
  const gradient = context.createLinearGradient(-width / 2, -height / 2, width / 2, height / 2);
  gradient.addColorStop(0, rgba(memory, 0.95));
  gradient.addColorStop(0.55, 'rgba(18, 21, 28, 0.94)');
  gradient.addColorStop(1, rgba(memory, 0.42));
  context.fillStyle = gradient;
  context.fillRect(-width / 2, -height / 2, width, height);
  context.fillStyle = 'rgba(255, 255, 255, 0.42)';
  context.font = `${String(Math.max(14, Math.min(32, width * 0.08)))}px system-ui, sans-serif`;
  context.textAlign = 'center';
  context.fillText('记忆', 0, 6);
}

function drawBackground(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  progress: number,
  stars: readonly Star[],
): void {
  const drift = progress * Math.PI * 2;
  const gradient = context.createRadialGradient(
    width * (0.5 + Math.sin(drift * 0.43) * 0.12),
    height * (0.42 + Math.cos(drift * 0.31) * 0.1),
    Math.min(width, height) * 0.04,
    width * 0.5,
    height * 0.54,
    Math.max(width, height) * 0.86,
  );
  gradient.addColorStop(0, '#162235');
  gradient.addColorStop(0.38, '#080f1b');
  gradient.addColorStop(1, '#020306');
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  for (const star of stars) {
    const shimmer = 0.62 + Math.sin(drift * 1.9 + star.drift) * 0.38;
    context.fillStyle = `rgba(222, 236, 255, ${String(star.alpha * shimmer)})`;
    context.beginPath();
    context.arc(star.x * width, star.y * height, star.radius, 0, Math.PI * 2);
    context.fill();
    if (star.radius > 1.55) {
      const x = star.x * width;
      const y = star.y * height;
      const beam = star.radius * 3.6;
      context.fillStyle = `rgba(222, 236, 255, ${String(star.alpha * shimmer * 0.28)})`;
      context.fillRect(x - beam, y - 0.35, beam * 2, 0.7);
      context.fillRect(x - 0.35, y - beam, 0.7, beam * 2);
    }
  }
}

function drawGeometryGuide(
  context: CanvasRenderingContext2D,
  layout: string,
  phaseProgress: number,
  canvasWidth: number,
  canvasHeight: number,
): void {
  if (layout !== 'wave' && layout !== 'sphere' && layout !== 'star' && layout !== 'torus' && layout !== 'prism') return;
  const centerX = canvasWidth * 0.5;
  const centerY = canvasHeight * 0.5;
  const radius = Math.min(canvasWidth, canvasHeight) * 0.24;
  const rotation = phaseProgress * Math.PI * 0.7;
  const opacity = 0.08 + Math.sin(phaseProgress * Math.PI) * 0.08;

  context.save();
  context.translate(centerX, centerY);
  context.rotate(rotation * 0.18);
  context.strokeStyle = `rgba(178, 211, 255, ${String(opacity)})`;
  context.lineWidth = Math.max(1, Math.min(canvasWidth, canvasHeight) * 0.0012);
  context.setLineDash([Math.max(3, radius * 0.025), Math.max(5, radius * 0.055)]);
  context.beginPath();

  if (layout === 'wave') {
    for (let index = 0; index <= 48; index += 1) {
      const t = index / 48;
      const x = (t - 0.5) * radius * 2.35;
      const y = Math.sin(t * Math.PI * 3.2 + phaseProgress * Math.PI * 1.2) * radius * 0.32;
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.moveTo(-radius * 1.16, radius * 0.24);
    for (let index = 1; index <= 48; index += 1) {
      const t = index / 48;
      const x = (t - 0.5) * radius * 2.35;
      const y = radius * 0.24 + Math.sin(t * Math.PI * 3.2 + phaseProgress * Math.PI * 1.2 + 0.72) * radius * 0.23;
      context.lineTo(x, y);
    }
  } else if (layout === 'sphere') {
    context.ellipse(0, 0, radius, radius * 0.78, 0, 0, Math.PI * 2);
    context.moveTo(-radius, 0);
    context.ellipse(0, 0, radius * 0.38, radius * 0.78, rotation, 0, Math.PI * 2);
    context.moveTo(-radius, 0);
    context.ellipse(0, 0, radius * 0.8, radius * 0.34, rotation * 0.6, 0, Math.PI * 2);
  } else if (layout === 'star') {
    for (let index = 0; index < 10; index += 1) {
      const pointRadius = index % 2 === 0 ? radius : radius * 0.47;
      const angle = -Math.PI / 2 + index * Math.PI / 5;
      const x = Math.cos(angle) * pointRadius;
      const y = Math.sin(angle) * pointRadius * 0.78;
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.closePath();
  } else if (layout === 'torus') {
    context.ellipse(0, 0, radius, radius * 0.55, 0, 0, Math.PI * 2);
    context.ellipse(0, 0, radius * 0.45, radius * 0.24, 0, 0, Math.PI * 2);
    context.moveTo(-radius * 0.94, 0);
    context.ellipse(0, 0, radius * 0.84, radius * 0.38, rotation, 0, Math.PI * 2);
  } else {
    const front: Array<readonly [number, number]> = [];
    const back: Array<readonly [number, number]> = [];
    for (let index = 0; index < 6; index += 1) {
      const angle = index * Math.PI / 3 + Math.PI / 6;
      front.push([Math.cos(angle) * radius * 0.72, Math.sin(angle) * radius * 0.48 - radius * 0.18]);
      back.push([Math.cos(angle) * radius * 0.72, Math.sin(angle) * radius * 0.48 + radius * 0.18]);
    }
    front.forEach(([x, y], index) => {
      const next = front[(index + 1) % front.length];
      if (!next) return;
      if (index === 0) context.moveTo(x, y);
      context.lineTo(next[0], next[1]);
      const backPoint = back[index];
      if (backPoint) {
        context.moveTo(x, y);
        context.lineTo(backPoint[0], backPoint[1]);
      }
    });
    context.moveTo(back[0]?.[0] ?? 0, back[0]?.[1] ?? 0);
    back.slice(1).forEach(([x, y]) => context.lineTo(x, y));
    context.closePath();
  }
  context.stroke();
  context.restore();
}

function drawPhoto(
  context: CanvasRenderingContext2D,
  rendered: RenderedPhoto,
  loaded: LoadedFrameImage | undefined,
  canvasWidth: number,
  canvasHeight: number,
): void {
  const { photo, projection, width, height } = rendered;
  const transform = photo.transform;
  const rotationYScale = Math.max(0.38, Math.abs(Math.cos(transform.rotation[1])));
  const frameWidth = clamp(width * rotationYScale, 10, canvasWidth * 1.45);
  const frameHeight = clamp(height, 10, canvasHeight * 1.45);
  const border = clamp(Math.min(frameWidth, frameHeight) * 0.021, 2, 18);
  const shadow = clamp(Math.min(frameWidth, frameHeight) * 0.032, 5, 32);
  const alpha = clamp01(transform.opacity);
  if (alpha <= 0.002) return;

  context.save();
  context.globalAlpha = alpha;
  context.translate(projection.x, projection.y);
  context.rotate(transform.rotation[2]);
  context.shadowColor = 'rgba(0, 0, 0, 0.65)';
  context.shadowBlur = shadow;
  context.shadowOffsetY = shadow * 0.42;
  context.fillStyle = 'rgba(244, 241, 234, 0.96)';
  context.fillRect(-frameWidth / 2 - border, -frameHeight / 2 - border, frameWidth + border * 2, frameHeight + border * 2);
  context.shadowColor = 'transparent';
  context.save();
  context.beginPath();
  context.rect(-frameWidth / 2, -frameHeight / 2, frameWidth, frameHeight);
  context.clip();
  if (loaded?.source) {
    context.translate(-frameWidth / 2, -frameHeight / 2);
    drawImageCover(context, loaded.source, loaded.width, loaded.height, frameWidth, frameHeight);
  } else {
    drawFallbackPhoto(context, photo.memory, frameWidth, frameHeight);
  }
  context.restore();
  if (photo.emphasis === 'hero') {
    context.strokeStyle = 'rgba(255, 255, 255, 0.86)';
    context.lineWidth = Math.max(1.5, border * 0.24);
    context.strokeRect(-frameWidth / 2 - border * 0.45, -frameHeight / 2 - border * 0.45, frameWidth + border * 0.9, frameHeight + border * 0.9);
  }
  context.restore();
}

function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

function add(left: Vec3, right: Vec3): Vec3 {
  return [left[0] + right[0], left[1] + right[1], left[2] + right[2]];
}

function multiply(vector: Vec3, scalar: number): Vec3 {
  return [vector[0] * scalar, vector[1] * scalar, vector[2] * scalar];
}

function drawFarewellParticles(
  context: CanvasRenderingContext2D,
  timeline: TimelineContext,
  farewell: FarewellSequenceState,
  canvasWidth: number,
  canvasHeight: number,
  reducedMotion: boolean,
): void {
  if (farewell.particleOpacity <= 0.002 || timeline.memories.length === 0) return;
  const count = reducedMotion ? REDUCED_EXPORT_PARTICLE_COUNT : EXPORT_PARTICLE_COUNT;
  const layout = timeline.layouts.mosaic;
  const dissolveTime = Math.max(0, farewell.localTime - 0.95);
  const seed = timeline.config.seed;
  const textTargets = createFarewellTextTargets(count, seed);

  context.save();
  for (let index = 0; index < count; index += 1) {
    const memory = timeline.memories[index % timeline.memories.length];
    if (!memory) continue;
    const transform = layout[memory.id];
    if (!transform) continue;
    const [planeWidth, planeHeight] = dimensions(memory);
    const sourceAngle = seededUnit(index, seed + 3) * Math.PI * 2;
    const edge = seededUnit(index, seed + 7) > 0.5;
    const source: Vec3 = [
      transform.position[0] + (edge
        ? Math.sign(Math.cos(sourceAngle) || 1) * planeWidth * transform.scale * 0.5
        : Math.cos(sourceAngle) * planeWidth * transform.scale * 0.5),
      transform.position[1] + (edge
        ? Math.sin(sourceAngle) * planeHeight * transform.scale * 0.5
        : Math.sign(Math.sin(sourceAngle) || 1) * planeHeight * transform.scale * 0.5),
      transform.position[2] + (seededUnit(index, seed + 11) - 0.5) * 0.16,
    ];
    const drift: Vec3 = [
      Math.cos(sourceAngle) * (0.28 + seededUnit(index, seed + 23) * 0.62),
      Math.sin(sourceAngle) * (0.2 + seededUnit(index, seed + 29) * 0.48),
      (seededUnit(index, seed + 31) - 0.5) * 0.82,
    ];
    const release = smoothstep((dissolveTime - seededUnit(index, seed + 37) * 0.58) / 1.35);
    const targetAngle = seededUnit(index, seed + 13) * Math.PI * 2;
    const targetRadius = 0.18 + seededUnit(index, seed + 17) * 1.2;
    const orbit = farewell.localTime * (0.08 + seededUnit(index, seed + 41) * 0.05);
    const target: Vec3 = [
      Math.cos(targetAngle) * targetRadius + Math.cos(orbit + index * 0.07) * 0.08,
      Math.sin(targetAngle) * targetRadius * 0.58 + Math.sin(orbit + index * 0.05) * 0.05,
      0.2 + (seededUnit(index, seed + 19) - 0.5) * 1.3,
    ];
    const released = add(source, multiply(drift, release));
    const gathered: Vec3 = [
      lerp(released[0], target[0], farewell.particleGather),
      lerp(released[1], target[1], farewell.particleGather),
      lerp(released[2], target[2], farewell.particleGather),
    ];
    const textTarget: Vec3 = [
      textTargets[index * 3] ?? gathered[0],
      textTargets[index * 3 + 1] ?? gathered[1],
      textTargets[index * 3 + 2] ?? gathered[2],
    ];
    const textPosition: Vec3 = [
      lerp(gathered[0], textTarget[0], farewell.particleTextOpacity),
      lerp(gathered[1], textTarget[1], farewell.particleTextOpacity),
      lerp(gathered[2], textTarget[2], farewell.particleTextOpacity),
    ];
    const burst = farewellParticleBurst(index, seed);
    const exploded: Vec3 = [
      textPosition[0] + burst[0] * farewell.particleExplosion,
      textPosition[1] + burst[1] * farewell.particleExplosion,
      textPosition[2] + burst[2] * farewell.particleExplosion,
    ];
    const projection = projectWorldPoint(exploded, {
      position: [0, 0.3, 9.25],
      target: [0, 0, -0.7],
      fov: 44,
    }, canvasWidth, canvasHeight);
    if (!projection.visible) continue;
    const size = clamp(projectedLength(0.015, projection), 1.2, reducedMotion ? 3.5 : 5.2);
    const [red, green, blue] = memory.dominantColor.rgb;
    context.fillStyle = `rgba(${String(red)}, ${String(green)}, ${String(blue)}, ${String(farewell.particleOpacity * (0.48 + release * 0.52))})`;
    context.beginPath();
    context.arc(projection.x, projection.y, size, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawFarewell(
  context: CanvasRenderingContext2D,
  timeline: TimelineContext,
  farewell: FarewellSequenceState,
  canvasWidth: number,
  canvasHeight: number,
  reducedMotion: boolean,
): void {
  if (!farewell.active) return;
  if (farewell.backgroundDim > 0.002) {
    context.fillStyle = `rgba(0, 0, 0, ${String(farewell.backgroundDim)})`;
    context.fillRect(0, 0, canvasWidth, canvasHeight);
  }
  drawFarewellParticles(context, timeline, farewell, canvasWidth, canvasHeight, reducedMotion);
}

/**
 * Deterministic Canvas renderer for actual export frames. It deliberately
 * reads the same TimelineEngine and FarewellSequence as the R3F preview, so
 * seeking/exporting cannot accidentally create a second, divergent story.
 */
export class MemoryFilmFrameRenderer {
  readonly canvas: HTMLCanvasElement;
  readonly context: CanvasRenderingContext2D;
  readonly timeline: TimelineContext;
  readonly durationSeconds: number;
  readonly reducedMotion: boolean;

  #images = new Map<string, LoadedFrameImage>();
  #stars: readonly Star[];

  private constructor(options: MemoryFilmFrameRendererOptions, context: CanvasRenderingContext2D) {
    this.canvas = options.canvas;
    this.context = context;
    this.durationSeconds = options.config.durationSeconds;
    this.reducedMotion = options.reducedMotion ?? false;
    const layouts = layoutEngine.prepare(options.config, options.memories, options.heroPhotoId);
    this.timeline = {
      config: options.config,
      memories: options.memories,
      heroPhotoId: options.heroPhotoId,
      layouts,
      phaseLayouts: composePhaseLayouts(
        options.config,
        options.memories,
        layouts,
        options.heroPhotoId,
        { aspect: options.canvas.width / Math.max(1, options.canvas.height) },
      ),
      reducedMotion: this.reducedMotion,
      viewportAspect: options.canvas.width / Math.max(1, options.canvas.height),
    };
    this.#stars = createStars(options.config.seed);
  }

  static async create(options: MemoryFilmFrameRendererOptions): Promise<MemoryFilmFrameRenderer> {
    const context = options.canvas.getContext('2d', { alpha: false, desynchronized: true });
    if (!context) throw new Error('EXPORT_CANVAS_CONTEXT_UNAVAILABLE');
    const renderer = new MemoryFilmFrameRenderer(options, context);
    try {
      for (const [index, memory] of options.memories.entries()) {
        abortIfNeeded(options.signal);
        const loaded = await loadMemoryImage(memory, options.signal);
        renderer.#images.set(memory.id, loaded);
        options.onPreparationProgress?.(index + 1, options.memories.length, memory.title || `照片 ${String(index + 1)}`);
      }
      return renderer;
    } catch (error) {
      renderer.dispose();
      throw error;
    }
  }

  sourceAudit(): ExportSourceAudit {
    const photoSources = this.timeline.memories.map((memory) => {
      const loaded = this.#images.get(memory.id);
      const width = loaded?.width ?? Math.max(1, memory.width);
      const height = loaded?.height ?? Math.max(1, memory.height);
      return {
        memoryId: memory.id,
        assetKey: loaded?.assetKey ?? null,
        width,
        height,
        has4kSourceDetail: Math.max(width, height) >= 3840,
      };
    });
    return {
      loadedPhotoCount: photoSources.filter((source) => source.assetKey !== null).length,
      fallbackPhotoCount: photoSources.filter((source) => source.assetKey === null).length,
      photoSources,
    };
  }

  renderAt(elapsedSeconds: number): RenderedFilmFrame {
    const progress = clamp01(elapsedSeconds / Math.max(0.001, this.durationSeconds));
    const state = evaluateTemplateState(progress, this.timeline);
    const farewell = evaluateFarewellSequence(elapsedSeconds, this.durationSeconds, this.reducedMotion);
    const { width: canvasWidth, height: canvasHeight } = this.canvas;
    drawBackground(this.context, canvasWidth, canvasHeight, progress, this.#stars);
    const phaseProgress = Math.min(1, Math.max(0, (progress - state.phase.start) / Math.max(0.001, state.phase.end - state.phase.start)));
    drawGeometryGuide(this.context, state.phase.layout, phaseProgress, canvasWidth, canvasHeight);

    const photos = state.photos
      .flatMap((photo): RenderedPhoto[] => {
        const projection = projectWorldPoint(photo.transform.position, state.camera, canvasWidth, canvasHeight);
        if (!projection.visible || photo.transform.opacity <= 0.002) return [];
        const [planeWidth, planeHeight] = dimensions(photo.memory);
        const width = projectedLength(planeWidth * photo.transform.scale, projection);
        const height = projectedLength(planeHeight * photo.transform.scale, projection);
        return width <= 0 || height <= 0 ? [] : [{ photo, projection, width, height }];
      })
      .toSorted((left, right) => right.projection.depth - left.projection.depth);
    for (const photo of photos) {
      drawPhoto(this.context, photo, this.#images.get(photo.photo.memory.id), canvasWidth, canvasHeight);
    }
    drawFarewell(this.context, this.timeline, farewell, canvasWidth, canvasHeight, this.reducedMotion);
    return { progress, phaseId: state.phase.id, farewell };
  }

  dispose(): void {
    for (const image of this.#images.values()) image.close();
    this.#images.clear();
  }
}
