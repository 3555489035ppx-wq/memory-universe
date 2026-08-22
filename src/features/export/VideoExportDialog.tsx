import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { getMemoryTemplate, resolveTemplateConfig } from '../../memory/config';
import { buildSongTimelineConfig } from '../../memory/engine/SongTimeline';
import { useMemoryTemplateStore } from '../../stores/memoryTemplateStore';
import { useMusicStore } from '../../stores/musicStore';
import { useSceneStore } from '../../stores/sceneStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useUiStore } from '../../stores/uiStore';
import { AUDIO_PRESETS } from '../music/audioPresets';

import { exportMemoryFilmVideo, type VideoExportError, type VideoExportProgress, type VideoExportResult } from './videoExportController';
import { materializeTrackAudio } from './exportAudioSource';
import { DEFAULT_VIDEO_EXPORT_PRESET_ID, getVideoExportPreset, VIDEO_EXPORT_PRESETS, type VideoExportPresetId } from './videoExportTypes';

interface ExportRunState {
  status: 'idle' | 'running' | 'completed' | 'error';
  progress: VideoExportProgress | null;
  result: VideoExportResult | null;
  error: string | null;
}

const INITIAL_RUN_STATE: ExportRunState = {
  status: 'idle',
  progress: null,
  result: null,
  error: null,
};

function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

function formatMegabytes(bytes: number | null): string {
  if (bytes === null) return '已流式写入磁盘';
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function exportErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return '视频导出未完成，请重试。';
}

export function VideoExportDialog(): ReactNode {
  const [open, setOpen] = useState(false);
  const [presetId, setPresetId] = useState<VideoExportPresetId>(DEFAULT_VIDEO_EXPORT_PRESET_ID);
  const [run, setRun] = useState<ExportRunState>(INITIAL_RUN_STATE);
  const abortRef = useRef<AbortController | null>(null);
  const session = useMemoryTemplateStore((state) => state.session);
  const dataset = useSceneStore((state) => state.dataset);
  const track = useMusicStore((state) => state.track);
  const musicDuration = useMusicStore((state) => state.duration);
  const audioPresetId = useMusicStore((state) => state.audioPreset);
  const reducedMotion = useSettingsStore((state) => state.settings.motion === 'reduced');
  const pushToast = useUiStore((state) => state.pushToast);

  const templateId = session?.templateId ?? null;
  const baseConfig = useMemo(
    () => (templateId ? resolveTemplateConfig(getMemoryTemplate(templateId), session?.overrides) : null),
    [session?.overrides, templateId],
  );
  const cueStart = track?.id ? session?.overrides?.songCueMap?.[track.id] ?? 0 : 0;
  const songDuration = musicDuration > cueStart ? musicDuration - cueStart : 0;
  const config = useMemo(
    () => (baseConfig && songDuration > 0 ? buildSongTimelineConfig(baseConfig, songDuration) : null),
    [baseConfig, songDuration],
  );
  const memories = useMemo(() => {
    if (!session || !dataset) return [];
    const byId = new Map(dataset.memories.map((memory) => [memory.id, memory]));
    const selected = session.memoryIds.flatMap((id) => {
      const memory = byId.get(id);
      return memory ? [memory] : [];
    });
    return selected;
  }, [dataset, session]);
  const preset = getVideoExportPreset(presetId);
  const localAudio = track?.source === 'upload' ? track.localFile ?? null : null;
  const hasAudioSource = Boolean(localAudio || track?.src);
  const missingPhotoCount = Math.max(0, (session?.memoryIds.length ?? 0) - memories.length);
  const canStart = Boolean(session && config && hasAudioSource && memories.length > 0 && missingPhotoCount === 0);
  const progressPercent = Math.round((run.progress?.progress ?? 0) * 100);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      if (run.status === 'running') return;
      setOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [run.status]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const close = useCallback((): void => {
    if (run.status === 'running') return;
    setOpen(false);
  }, [run.status]);

  const startExport = useCallback((): void => {
    if (!session || !config || !track || (!localAudio && track.source === 'upload') || memories.length === 0 || missingPhotoCount > 0) return;
    const selectedTrack = track;
    const controller = new AbortController();
    abortRef.current = controller;
    setRun({
      status: 'running',
      progress: { stage: 'preflight', progress: 0, label: localAudio ? '准备真实 4K 导出' : '正在下载当前歌曲并准备真实 4K 导出' },
      result: null,
      error: null,
    });
    void materializeTrackAudio(selectedTrack, controller.signal).then((exportAudio) => exportMemoryFilmVideo({
      preset,
      config,
      memories,
      heroPhotoId: session.heroPhotoId,
      audioFile: exportAudio,
      audioPresetId,
      audioStartSeconds: cueStart,
      reducedMotion,
      suggestedFileName: `${config.title}-MEMENTO-${String(preset.width)}x${String(preset.height)}.mp4`,
      signal: controller.signal,
      onProgress: (progress) => setRun((current) => ({ ...current, progress })),
    }))
      .then((result) => {
        abortRef.current = null;
        setRun({ status: 'completed', progress: { stage: 'completed', progress: 1, label: '导出完成' }, result, error: null });
        const weakSources = result.sourceAudit.photoSources.filter((source) => !source.has4kSourceDetail).length;
        pushToast(
          weakSources > 0
            ? `4K MP4 已完成；${String(weakSources)} 张照片使用现有预览图清晰度。`
            : '4K MP4 与本地母带音频已完成。',
          weakSources > 0 ? 'neutral' : 'success',
          7000,
        );
      })
      .catch((error: unknown) => {
        abortRef.current = null;
        const code = controller.signal.aborted
          ? 'EXPORT_CANCELLED'
          : error && typeof error === 'object' && 'code' in error ? (error as VideoExportError).code : null;
        const message = code === 'EXPORT_CANCELLED' ? '视频导出已取消，未把低清预览当作成片保存。' : exportErrorMessage(error);
        setRun({ status: 'error', progress: null, result: null, error: message });
        if (code !== 'EXPORT_CANCELLED') pushToast(message, 'danger', 7000);
      });
  }, [audioPresetId, config, cueStart, localAudio, memories, missingPhotoCount, preset, pushToast, reducedMotion, session, track]);

  if (!session) return null;

  return (
    <div className="video-export">
      <button className="secondary" type="button" onClick={() => setOpen(true)}>
        导出视频
      </button>
      {open && typeof document !== 'undefined' && createPortal(
        <div className="video-export__backdrop" role="presentation" onPointerDown={close}>
          <section
            className="video-export__dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="video-export-title"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <header className="video-export__heading">
              <div>
                <p>本地生成 · 不上传照片或音乐</p>
                <h2 id="video-export-title">导出记忆电影</h2>
              </div>
              <button type="button" aria-label="关闭导出窗口" disabled={run.status === 'running'} onClick={close}>×</button>
            </header>

            <div className="video-export__format" role="group" aria-label="导出分辨率">
              {(Object.keys(VIDEO_EXPORT_PRESETS) as VideoExportPresetId[]).map((id) => {
                const option = VIDEO_EXPORT_PRESETS[id];
                return (
                  <button
                    key={id}
                    type="button"
                    data-selected={presetId === id || undefined}
                    disabled={run.status === 'running'}
                    onClick={() => setPresetId(id)}
                  >
                    <strong>{option.label}</strong>
                    <span>{option.description}</span>
                  </button>
                );
              })}
            </div>

            <dl className="video-export__facts">
              <div><dt>时间线</dt><dd>{config ? formatDuration(config.durationSeconds) : '等待本地音频元数据'}</dd></div>
              <div><dt>照片</dt><dd>{memories.length}/{session.memoryIds.length} 张</dd></div>
              <div><dt>声音</dt><dd>{hasAudioSource ? AUDIO_PRESETS[audioPresetId].label : '需要音频'}</dd></div>
              <div><dt>输出</dt><dd>{preset.width} × {preset.height} · {preset.fps} fps</dd></div>
            </dl>

            {!localAudio && !hasAudioSource && (
              <p className="video-export__warning" role="status">
                请在音乐面板选择系统音乐库中的歌曲，或上传你有权使用的 MP3 / WAV。
              </p>
            )}
            {songDuration <= 0 && hasAudioSource && (
              <p className="video-export__warning" role="status">正在读取本地音频时长；读取完成后即可导出完整歌曲。</p>
            )}
            {missingPhotoCount > 0 && (
              <p className="video-export__warning" role="alert">有 {missingPhotoCount} 张模板照片不在当前宇宙数据中，请重新打开模板后再导出。</p>
            )}

            {run.status === 'running' && run.progress && (
              <div className="video-export__progress" role="status" aria-live="polite">
                <div><strong>{progressPercent}%</strong><span>{run.progress.label}</span></div>
                <progress value={run.progress.progress} max="1" />
                {run.progress.completedFrames !== undefined && run.progress.totalFrames !== undefined && (
                  <small>{run.progress.completedFrames}/{run.progress.totalFrames} 帧 · 可取消，已完成帧不会被替换为低清版本。</small>
                )}
              </div>
            )}

            {run.status === 'error' && <p className="video-export__error" role="alert">{run.error}</p>}
            {run.status === 'completed' && run.result && (
              <div className="video-export__result" role="status">
                <strong>已生成真实 {run.result.width} × {run.result.height} MP4</strong>
                <span>{formatMegabytes(run.result.byteLength)} · {run.result.mimeType}</span>
                <span>
                  {run.result.audioCodec.toUpperCase()} {Math.round(run.result.audioBitrate / 1000)} kbps
                  {run.result.audioCodecFallback
                    ? '（当前浏览器无 AAC 编码器，已明确使用 Opus；发送前请确认目标平台支持）'
                    : run.result.audioBitrateFallback
                      ? '（当前浏览器不支持预设目标，已明确使用兼容码率）'
                      : ''}
                </span>
                <span>响度估计 {run.result.integratedLufsEstimate.toFixed(1)} LUFS · 峰值估计 {run.result.maximumTruePeakDbtpEstimate.toFixed(1)} dBTP</span>
                {run.result.sourceAudit.fallbackPhotoCount > 0 && (
                  <span>有 {run.result.sourceAudit.fallbackPhotoCount} 张照片缺少可读图像，已使用其主色记忆卡而非空白洞。</span>
                )}
                {run.result.sourceAudit.photoSources.some((source) => !source.has4kSourceDetail) && (
                  <span>说明：视频容器与画布为原生 4K；旧导入照片若只有 1600px 预览图，其照片细节不会被虚假放大。重新导入原图后会保留 4K 母片。</span>
                )}
              </div>
            )}

            <footer className="video-export__actions">
              {run.status === 'running' ? (
                <button type="button" className="secondary" onClick={() => abortRef.current?.abort()}>取消导出</button>
              ) : (
                <>
                  <button type="button" className="secondary" onClick={close}>关闭</button>
                  <button type="button" className="primary" disabled={!canStart} onClick={startExport}>
                    {run.status === 'completed' ? '再次导出' : `开始 ${preset.label} 导出`}
                  </button>
                </>
              )}
            </footer>
          </section>
        </div>,
        document.body,
      )}
    </div>
  );
}
