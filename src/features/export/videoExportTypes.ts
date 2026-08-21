export type VideoExportPresetId = 'mobile-4k' | 'mobile-1080' | 'desktop-4k' | 'draft';

export interface VideoExportPreset {
  id: VideoExportPresetId;
  label: string;
  description: string;
  width: number;
  height: number;
  fps: number;
  videoBitrate: number;
  audioBitrate: number;
  orientation: 'portrait' | 'landscape';
}

export const VIDEO_EXPORT_PRESETS: Readonly<Record<VideoExportPresetId, VideoExportPreset>> = {
  'mobile-4k': {
    id: 'mobile-4k',
    label: '手机 4K',
    description: '2160 × 3840 · 30 fps · H.264 / 高品质音频 MP4',
    width: 2160,
    height: 3840,
    fps: 30,
    videoBitrate: 40_000_000,
    audioBitrate: 320_000,
    orientation: 'portrait',
  },
  'mobile-1080': {
    id: 'mobile-1080',
    label: '手机 1080P',
    description: '1080 × 1920 · 30 fps · 快速分享版',
    width: 1080,
    height: 1920,
    fps: 30,
    videoBitrate: 12_000_000,
    audioBitrate: 256_000,
    orientation: 'portrait',
  },
  'desktop-4k': {
    id: 'desktop-4k',
    label: '横版 4K',
    description: '3840 × 2160 · 30 fps · H.264 / 高品质音频 MP4',
    width: 3840,
    height: 2160,
    fps: 30,
    videoBitrate: 40_000_000,
    audioBitrate: 320_000,
    orientation: 'landscape',
  },
  draft: {
    id: 'draft',
    label: '快速检查',
    description: '540 × 960 · 24 fps · 用于确认节奏，不替代成片',
    width: 540,
    height: 960,
    fps: 24,
    videoBitrate: 2_800_000,
    audioBitrate: 192_000,
    orientation: 'portrait',
  },
};

export const DEFAULT_VIDEO_EXPORT_PRESET_ID: VideoExportPresetId = 'mobile-4k';

export function getVideoExportPreset(id: VideoExportPresetId): VideoExportPreset {
  return VIDEO_EXPORT_PRESETS[id];
}

/** Uses an exact integer frame count so the encoded timeline is deterministic. */
export function frameCountForDuration(durationSeconds: number, fps: number): number {
  const safeDuration = Number.isFinite(durationSeconds) ? Math.max(0, durationSeconds) : 0;
  const safeFps = Number.isFinite(fps) ? Math.max(1, Math.round(fps)) : 30;
  return Math.max(1, Math.round(safeDuration * safeFps));
}

export function exportedDurationSeconds(frameCount: number, fps: number): number {
  return Math.max(1, Math.floor(frameCount)) / Math.max(1, Math.round(fps));
}

export function isNative4kPreset(preset: Pick<VideoExportPreset, 'width' | 'height'>): boolean {
  return (preset.width === 2160 && preset.height === 3840)
    || (preset.width === 3840 && preset.height === 2160);
}
