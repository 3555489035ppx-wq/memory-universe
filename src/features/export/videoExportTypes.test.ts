import { describe, expect, it } from 'vitest';

import { inspectVideoExportCapability } from './videoExportCapabilities';
import { projectWorldPoint, projectedLength } from './frameProjection';
import { DEFAULT_VIDEO_EXPORT_PRESET_ID, frameCountForDuration, getVideoExportPreset, isNative4kPreset } from './videoExportTypes';

describe('4K video export contracts', () => {
  it('keeps the mobile default at true portrait 4K instead of upscaling a preview mode', () => {
    const preset = getVideoExportPreset(DEFAULT_VIDEO_EXPORT_PRESET_ID);
    expect(preset).toMatchObject({ width: 2160, height: 3840, fps: 30 });
    expect(isNative4kPreset(preset)).toBe(true);
    expect(frameCountForDuration(6.8, 30)).toBe(204);
  });

  it('fails closed when the requested physical canvas cannot be allocated', () => {
    const result = inspectVideoExportCapability(
      { width: 2160, height: 3840 },
      {
        createCanvas: () => ({ width: 540, height: 960, getContext: () => ({}) }),
        hasVideoEncoder: true,
        hasAudioEncoder: true,
        hasSaveFilePicker: true,
      },
    );
    expect(result.canRender).toBe(false);
    expect(result.blockers).toContain('CANVAS_ALLOCATION_FAILED');
  });

  it('projects authored camera space deterministically for the frame renderer', () => {
    const point = projectWorldPoint([0, 0, 0], {
      position: [0, 0, 9],
      target: [0, 0, 0],
      fov: 45,
    }, 2160, 3840);
    expect(point.visible).toBe(true);
    expect(point.x).toBeCloseTo(1080);
    expect(point.y).toBeCloseTo(1920);
    expect(projectedLength(1, point)).toBeGreaterThan(0);
  });
});
