import type { VideoExportPreset } from './videoExportTypes';

export type ExportCapabilityCode =
  | 'CANVAS_UNAVAILABLE'
  | 'CANVAS_ALLOCATION_FAILED'
  | 'VIDEO_ENCODER_UNAVAILABLE'
  | 'AUDIO_ENCODER_UNAVAILABLE'
  | 'FILE_STREAM_UNAVAILABLE';

export interface VideoExportCapability {
  canRender: boolean;
  canEncodeVideo: boolean;
  canEncodeAudio: boolean;
  canStreamToDisk: boolean;
  blockers: ExportCapabilityCode[];
}

export interface ExportCapabilityEnvironment {
  createCanvas?: (width: number, height: number) => { width: number; height: number; getContext: (type: '2d') => unknown } | null;
  hasVideoEncoder?: boolean;
  hasAudioEncoder?: boolean;
  hasSaveFilePicker?: boolean;
}

function browserEnvironment(): ExportCapabilityEnvironment {
  const canCreateCanvas = typeof document !== 'undefined';
  return {
    ...(canCreateCanvas
      ? { createCanvas: (width: number, height: number) => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        return canvas;
      } }
      : {}),
    hasVideoEncoder: typeof VideoEncoder !== 'undefined',
    hasAudioEncoder: typeof AudioEncoder !== 'undefined',
    hasSaveFilePicker: typeof (window as Window & { showSaveFilePicker?: unknown }).showSaveFilePicker === 'function',
  };
}

/**
 * Checks actual target allocation instead of treating a lower-resolution
 * preview as a 4K export. Codec support is verified again by Mediabunny at
 * export start because browser encoders vary by codec/profile.
 */
export function inspectVideoExportCapability(
  preset: Pick<VideoExportPreset, 'width' | 'height'>,
  environment: ExportCapabilityEnvironment = browserEnvironment(),
): VideoExportCapability {
  const blockers: ExportCapabilityCode[] = [];
  let canRender = false;
  if (!environment.createCanvas) {
    blockers.push('CANVAS_UNAVAILABLE');
  } else {
    try {
      const canvas = environment.createCanvas(preset.width, preset.height);
      canRender = Boolean(
        canvas
        && canvas.width === preset.width
        && canvas.height === preset.height
        && canvas.getContext('2d'),
      );
      if (!canRender) blockers.push('CANVAS_ALLOCATION_FAILED');
    } catch {
      blockers.push('CANVAS_ALLOCATION_FAILED');
    }
  }
  const canEncodeVideo = environment.hasVideoEncoder === true;
  const canEncodeAudio = environment.hasAudioEncoder === true;
  if (!canEncodeVideo) blockers.push('VIDEO_ENCODER_UNAVAILABLE');
  if (!canEncodeAudio) blockers.push('AUDIO_ENCODER_UNAVAILABLE');
  const canStreamToDisk = environment.hasSaveFilePicker === true;
  if (!canStreamToDisk) blockers.push('FILE_STREAM_UNAVAILABLE');
  return { canRender, canEncodeVideo, canEncodeAudio, canStreamToDisk, blockers };
}

export function capabilityMessage(code: ExportCapabilityCode): string {
  if (code === 'CANVAS_UNAVAILABLE') return '当前环境无法创建视频画布。';
  if (code === 'CANVAS_ALLOCATION_FAILED') return '当前设备无法分配所选分辨率的真实画布，未执行降分辨率伪 4K。';
  if (code === 'VIDEO_ENCODER_UNAVAILABLE') return '浏览器不支持所需的视频编码器。';
  if (code === 'AUDIO_ENCODER_UNAVAILABLE') return '浏览器不支持所需的 AAC 音频编码器。';
  return '当前浏览器不能直接流式写入磁盘，将在完成后通过下载保存，4K 长片会占用更多内存。';
}
