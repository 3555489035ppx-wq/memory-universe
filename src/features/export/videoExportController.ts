import type { Memory } from '../../domain/memory';
import type { MemoryTemplateConfig } from '../../memory/types';
import type { AudioPresetId } from '../music/audioPresets';
import type { StreamTargetChunk } from 'mediabunny';

import { decodeAndMasterAudio, trimAudioBuffer } from './audioRender';
import { MemoryFilmFrameRenderer, type ExportSourceAudit } from './MemoryFilmFrameRenderer';
import { capabilityMessage, inspectVideoExportCapability } from './videoExportCapabilities';
import { frameCountForDuration, type VideoExportPreset } from './videoExportTypes';

export type VideoExportStage =
  | 'preflight'
  | 'preparing-photos'
  | 'mastering-audio'
  | 'encoding-video'
  | 'finalizing'
  | 'saving'
  | 'completed';

export interface VideoExportProgress {
  stage: VideoExportStage;
  progress: number;
  label: string;
  completedFrames?: number;
  totalFrames?: number;
}

export interface VideoExportRequest {
  preset: VideoExportPreset;
  config: MemoryTemplateConfig;
  memories: readonly Memory[];
  heroPhotoId: string | null;
  audioFile: File | null;
  audioPresetId: AudioPresetId;
  audioStartSeconds?: number;
  reducedMotion?: boolean;
  suggestedFileName?: string;
  signal?: AbortSignal;
  onProgress?: (progress: VideoExportProgress) => void;
  /** Optional diagnostic hook; the UI never stores the finished Blob in app state. */
  onOutputBlob?: (blob: Blob) => void | Promise<void>;
}

export interface VideoExportResult {
  fileName: string;
  mimeType: string;
  width: number;
  height: number;
  fps: number;
  durationSeconds: number;
  frameCount: number;
  /** Requested AAC target can be lower on a browser that rejects the ideal mode. */
  audioCodec: string;
  audioCodecFallback: boolean;
  audioBitrate: number;
  audioBitrateFallback: boolean;
  saveMode: 'disk' | 'download';
  byteLength: number | null;
  sourceAudit: ExportSourceAudit;
  integratedLufsEstimate: number;
  maximumTruePeakDbtpEstimate: number;
}

export type VideoExportErrorCode =
  | 'EXPORT_CANCELLED'
  | 'LOCAL_AUDIO_REQUIRED'
  | 'CANVAS_UNAVAILABLE'
  | 'CANVAS_ALLOCATION_FAILED'
  | 'VIDEO_ENCODER_UNAVAILABLE'
  | 'AUDIO_ENCODER_UNAVAILABLE'
  | 'VIDEO_CODEC_UNAVAILABLE'
  | 'AUDIO_CODEC_UNAVAILABLE'
  | 'MP4_FINALIZATION_FAILED'
  | 'EXPORT_FAILED';

export class VideoExportError extends Error {
  readonly code: VideoExportErrorCode;

  constructor(code: VideoExportErrorCode, message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'VideoExportError';
    this.code = code;
  }
}

interface SavePickerWindow extends Window {
  showSaveFilePicker?: (options: {
    suggestedName: string;
    types: Array<{ description: string; accept: Record<string, string[]> }>;
  }) => Promise<{ createWritable: () => Promise<WritableStream<unknown>> }>;
}

type ExportDestination =
  | { mode: 'disk'; writable: WritableStream<unknown> }
  | { mode: 'download' };

function abortIfNeeded(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('Video export cancelled.', 'AbortError');
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function defaultFileName(): string {
  const stamp = new Date().toISOString().replace(/[:.]/gu, '-').replace(/Z$/u, '');
  return `memento-memory-film-${stamp}.mp4`;
}

function normalizedFileName(value: string | undefined): string {
  const raw = (value?.trim() || defaultFileName()).replace(/[\\/:*?"<>|]/gu, '-');
  return raw.toLowerCase().endsWith('.mp4') ? raw : `${raw}.mp4`;
}

/**
 * WebCodecs AAC limits vary by browser and device. We try the requested
 * transparent target first, then only explicit, visible fallbacks. This keeps
 * a failed 320 kbps configuration from aborting an otherwise valid 4K film,
 * without ever misreporting the delivered audio bitrate.
 */
function audioBitrateCandidates(target: number): readonly number[] {
  return [...new Set([
    target,
    Math.min(target, 256_000),
    Math.min(target, 224_000),
    Math.min(target, 192_000),
    Math.min(target, 160_000),
    Math.min(target, 128_000),
  ].filter((bitrate) => bitrate >= 128_000))];
}

function report(
  request: VideoExportRequest,
  stage: VideoExportStage,
  progress: number,
  label: string,
  frame?: { completedFrames: number; totalFrames: number },
): void {
  request.onProgress?.({
    stage,
    progress: Math.min(1, Math.max(0, progress)),
    label,
    ...(frame ?? {}),
  });
}

async function chooseDestination(fileName: string): Promise<ExportDestination> {
  const picker = (window as SavePickerWindow).showSaveFilePicker;
  if (!picker) return { mode: 'download' };
  const handle = await picker.call(window, {
    suggestedName: fileName,
    types: [{ description: 'MP4 视频', accept: { 'video/mp4': ['.mp4'] } }],
  });
  return { mode: 'disk', writable: await handle.createWritable() };
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = 'none';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function toExportError(error: unknown): VideoExportError {
  if (error instanceof VideoExportError) return error;
  if (isAbort(error)) return new VideoExportError('EXPORT_CANCELLED', '视频导出已取消。', error);
  return new VideoExportError('EXPORT_FAILED', '视频导出未完成；请检查设备编码支持、磁盘空间与本地音频后重试。', error);
}

async function yieldToBrowser(): Promise<void> {
  await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
}

/**
 * Renders every timeline frame at the selected physical resolution, encodes it
 * through Mediabunny/WebCodecs, and muxes the locally mastered AAC track into
 * one MP4. There is no resolution fallback: unavailable 4K hardware fails
 * visibly rather than silently producing an upscaled preview.
 */
export async function exportMemoryFilmVideo(request: VideoExportRequest): Promise<VideoExportResult> {
  const fileName = normalizedFileName(request.suggestedFileName);
  const capability = inspectVideoExportCapability(request.preset);
  const hardBlocker = capability.blockers.find((code) => code !== 'FILE_STREAM_UNAVAILABLE');
  if (hardBlocker) {
    throw new VideoExportError(hardBlocker, capabilityMessage(hardBlocker));
  }
  if (!request.audioFile) {
    throw new VideoExportError('LOCAL_AUDIO_REQUIRED', '4K 成片必须选择你有权使用的本地音频，远程流不会被录制或导出。');
  }
  abortIfNeeded(request.signal);
  report(request, 'preflight', 0.01, `${String(request.preset.width)} × ${String(request.preset.height)} 真实画布已验证`);

  // This call intentionally happens before any long async preparation so a
  // Chromium browser may preserve the button's user activation for the save picker.
  let destination: ExportDestination | null = null;
  try {
    destination = await chooseDestination(fileName);
  } catch (error) {
    throw toExportError(error);
  }

  let renderer: MemoryFilmFrameRenderer | null = null;
  let output: { state: string; cancel: () => Promise<void>; finalize: () => Promise<void>; getMimeType: () => Promise<string> } | null = null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = request.preset.width;
    canvas.height = request.preset.height;
    if (canvas.width !== request.preset.width || canvas.height !== request.preset.height) {
      throw new VideoExportError('CANVAS_ALLOCATION_FAILED', '无法分配所选 4K 原生画布，未生成伪 4K 文件。');
    }
    renderer = await MemoryFilmFrameRenderer.create({
      canvas,
      config: request.config,
      memories: request.memories,
      heroPhotoId: request.heroPhotoId,
      ...(request.reducedMotion === undefined ? {} : { reducedMotion: request.reducedMotion }),
      ...(request.signal ? { signal: request.signal } : {}),
      onPreparationProgress: (completed, total, label) => {
        report(request, 'preparing-photos', 0.03 + (completed / Math.max(1, total)) * 0.17, `准备照片 ${String(completed)}/${String(total)} · ${label}`);
      },
    });
    const sourceAudit = renderer.sourceAudit();
    abortIfNeeded(request.signal);

    const mastered = await decodeAndMasterAudio(request.audioFile, {
      presetId: request.audioPresetId,
      ...(request.signal ? { signal: request.signal } : {}),
      onProgress: (progress, label) => report(request, 'mastering-audio', 0.2 + progress * 0.16, label),
    });
    const exportAudio = trimAudioBuffer(
      mastered.audioBuffer,
      request.audioStartSeconds ?? 0,
      request.config.durationSeconds,
    );
    abortIfNeeded(request.signal);

    const media = await import('mediabunny');
    const outputFormat = new media.Mp4OutputFormat();
    const videoQuality = new media.Quality({ bitrate: request.preset.videoBitrate, bitrateMode: 'variable' });
    const videoCodec = await media.getFirstEncodableVideoCodec(outputFormat.getSupportedVideoCodecs(), {
      width: request.preset.width,
      height: request.preset.height,
      quality: videoQuality,
    });
    let audioCodec: Awaited<ReturnType<typeof media.getFirstEncodableAudioCodec>> = null;
    let audioQuality = new media.Quality({ bitrate: 128_000, bitrateMode: 'constant' });
    let audioBitrate = 0;
    const supportedAudioCodecs = outputFormat.getSupportedAudioCodecs();
    // Try every supported AAC bitrate before accepting another codec. A lower
    // AAC bitrate is usually more portable for a phone-delivered MP4 than a
    // high-bitrate codec that a receiving app may not decode.
    const codecGroups = [
      supportedAudioCodecs.filter((codec) => codec === 'aac'),
      supportedAudioCodecs.filter((codec) => codec !== 'aac'),
    ].filter((codecs) => codecs.length > 0);
    for (const codecs of codecGroups) {
      for (const candidateBitrate of audioBitrateCandidates(request.preset.audioBitrate)) {
        const candidateQuality = new media.Quality({ bitrate: candidateBitrate, bitrateMode: 'constant' });
        const candidateCodec = await media.getFirstEncodableAudioCodec(codecs, {
          numberOfChannels: exportAudio.numberOfChannels,
          sampleRate: exportAudio.sampleRate,
          quality: candidateQuality,
        });
        if (!candidateCodec) continue;
        audioCodec = candidateCodec;
        audioQuality = candidateQuality;
        audioBitrate = candidateBitrate;
        break;
      }
      if (audioCodec) break;
    }
    if (!videoCodec) throw new VideoExportError('VIDEO_CODEC_UNAVAILABLE', '当前浏览器无法编码所需的 H.264/MP4 视频。');
    if (!audioCodec) throw new VideoExportError('AUDIO_CODEC_UNAVAILABLE', '当前浏览器无法编码所需的 AAC/MP4 音频。');

    const target = destination.mode === 'disk'
      ? new media.StreamTarget(destination.writable as unknown as WritableStream<StreamTargetChunk>, { chunked: true })
      : new media.BufferTarget();
    const concreteOutput = new media.Output({ format: outputFormat, target });
    output = concreteOutput;
    const videoSource = new media.CanvasSource(canvas, {
      codec: videoCodec,
      quality: videoQuality,
      keyFrameInterval: 2,
    });
    const audioSource = new media.AudioBufferSource({
      codec: audioCodec,
      quality: audioQuality,
    });
    concreteOutput.addVideoTrack(videoSource);
    concreteOutput.addAudioTrack(audioSource);
    concreteOutput.setMetadataTags({ title: 'MEMENTO · 再见了，我们的青春' });
    await concreteOutput.start();
    report(request, 'encoding-video', 0.37, `写入 ${request.preset.label} 音频轨道`);
    await audioSource.add(exportAudio);

    const totalFrames = frameCountForDuration(request.config.durationSeconds, request.preset.fps);
    for (let frame = 0; frame < totalFrames; frame += 1) {
      abortIfNeeded(request.signal);
      const timestamp = frame / request.preset.fps;
      renderer.renderAt(timestamp);
      await videoSource.add(timestamp, 1 / request.preset.fps, {
        keyFrame: frame % (request.preset.fps * 2) === 0,
      });
      if (frame === totalFrames - 1 || frame % Math.max(1, Math.floor(request.preset.fps / 2)) === 0) {
        report(
          request,
          'encoding-video',
          0.4 + ((frame + 1) / totalFrames) * 0.53,
          `编码第 ${String(frame + 1)}/${String(totalFrames)} 帧`,
          { completedFrames: frame + 1, totalFrames },
        );
      }
      if (frame % 8 === 7) await yieldToBrowser();
    }
    report(request, 'finalizing', 0.95, '封装 MP4 索引与音视频时间戳');
    await concreteOutput.finalize();
    const mimeType = await concreteOutput.getMimeType();
    let byteLength: number | null = null;
    if (destination.mode === 'download') {
      const buffer = (target as InstanceType<typeof media.BufferTarget>).buffer;
      if (!buffer) throw new VideoExportError('MP4_FINALIZATION_FAILED', 'MP4 封装未返回完整文件。');
      const blob = new Blob([buffer], { type: mimeType });
      byteLength = blob.size;
      await request.onOutputBlob?.(blob);
      report(request, 'saving', 0.98, '浏览器正在保存 MP4 文件');
      downloadBlob(blob, fileName);
    }
    report(request, 'completed', 1, destination.mode === 'disk' ? '4K MP4 已写入所选位置' : '4K MP4 已开始下载');
    return {
      fileName,
      mimeType,
      width: request.preset.width,
      height: request.preset.height,
      fps: request.preset.fps,
      durationSeconds: request.config.durationSeconds,
      frameCount: totalFrames,
      audioCodec,
      audioCodecFallback: audioCodec !== 'aac',
      audioBitrate,
      audioBitrateFallback: audioBitrate !== request.preset.audioBitrate,
      saveMode: destination.mode,
      byteLength,
      sourceAudit,
      integratedLufsEstimate: mastered.outputMetrics.integratedLufs,
      maximumTruePeakDbtpEstimate: mastered.outputMetrics.maximumTruePeakDbtp,
    };
  } catch (error) {
    if (output && output.state !== 'finalized' && output.state !== 'canceled') {
      await output.cancel().catch(() => undefined);
    } else if (destination.mode === 'disk') {
      // createWritable() can create the target file before the canvas/codec
      // preflight finishes. Abort it so an unsupported export is never left as
      // an empty file that looks like a completed MP4.
      await destination.writable.abort(error).catch(() => undefined);
    }
    throw toExportError(error);
  } finally {
    renderer?.dispose();
  }
}
