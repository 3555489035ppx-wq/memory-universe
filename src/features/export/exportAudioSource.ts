import type { MusicTrack } from '../../stores/musicStore';

export class ExportAudioSourceError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'ExportAudioSourceError';
  }
}

function fileExtension(fileName: string): string {
  const match = /\.([a-z0-9]{2,5})$/iu.exec(fileName);
  return match?.[1]?.toLowerCase() ?? 'mp3';
}

function audioMimeType(fileName: string, responseType: string): string {
  if (responseType.startsWith('audio/')) return responseType;
  const extension = fileExtension(fileName);
  if (extension === 'flac') return 'audio/flac';
  if (extension === 'wav') return 'audio/wav';
  if (extension === 'm4a' || extension === 'mp4') return 'audio/mp4';
  if (extension === 'ogg' || extension === 'oga') return 'audio/ogg';
  return 'audio/mpeg';
}

function safeFileName(track: MusicTrack): string {
  const raw = (track.fileName || track.name || 'memento-song').trim().replace(/[\\/:*?"<>|]/gu, '-');
  return /\.[a-z0-9]{2,5}$/iu.test(raw) ? raw : `${raw}.mp3`;
}

/** Materializes a system asset or user upload for the local export pipeline. */
export async function materializeTrackAudio(track: MusicTrack, signal?: AbortSignal): Promise<File> {
  if (track.source === 'upload' && track.localFile) return track.localFile;
  if (signal?.aborted) throw new DOMException('Audio preparation cancelled.', 'AbortError');

  const sourceUrl = track.src;
  if (!sourceUrl) {
    throw new ExportAudioSourceError('当前歌曲没有可用的音频地址。');
  }

  let response: Response;
  try {
    response = await fetch(sourceUrl, {
      cache: 'no-store',
      credentials: 'omit',
      ...(signal ? { signal } : {}),
    });
  } catch (error) {
    if (signal?.aborted || (error instanceof DOMException && error.name === 'AbortError')) throw error;
    throw new ExportAudioSourceError('歌曲读取失败，请检查系统音乐文件或重新上传。', error);
  }
  if (!response.ok) {
    throw new ExportAudioSourceError(`歌曲读取失败（HTTP ${String(response.status)}），请更换一首音乐。`);
  }

  const blob = await response.blob();
  if (blob.size <= 0) throw new ExportAudioSourceError('音频文件为空，无法生成视频。');
  return new File([blob], safeFileName(track), { type: audioMimeType(track.fileName, blob.type) });
}
