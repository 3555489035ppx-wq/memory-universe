import type { MusicTrack } from '../../stores/musicStore';
import { getMusicStream } from '../music/musicService';

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

/**
 * Turns a remote playback source into a local in-memory File for the export
 * pipeline. The browser never uploads it: fetch -> decode/master -> mux all
 * stay on this device. Local files are returned untouched.
 */
export async function materializeTrackAudio(track: MusicTrack, signal?: AbortSignal): Promise<File> {
  if (track.source === 'local' && track.localFile) return track.localFile;
  if (signal?.aborted) throw new DOMException('Audio preparation cancelled.', 'AbortError');

  let sourceUrl = track.src;
  if (!sourceUrl && track.source !== 'local') {
    try {
      sourceUrl = (await getMusicStream(track)).proxiedUrl;
    } catch (error) {
      throw new ExportAudioSourceError('无法取得当前歌曲的可下载音频地址，请先重新播放歌曲后再导出。', error);
    }
  }
  if (!sourceUrl) {
    throw new ExportAudioSourceError('当前歌曲没有可用的本地或远程音频地址。');
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
    throw new ExportAudioSourceError('歌曲下载失败，请检查本机音乐服务和当前歌曲的播放地址。', error);
  }
  if (!response.ok) {
    throw new ExportAudioSourceError(`歌曲下载失败（HTTP ${String(response.status)}），请先重新连接音乐源。`);
  }

  const blob = await response.blob();
  if (blob.size <= 0) throw new ExportAudioSourceError('音乐服务返回了空音频，无法生成视频。');
  return new File([blob], safeFileName(track), { type: audioMimeType(track.fileName, blob.type) });
}
