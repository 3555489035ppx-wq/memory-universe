interface PlaybackPreparationState {
  source?: 'local' | 'remote' | undefined;
  src: string;
  status: string;
}

interface RemoteStreamFreshnessState {
  source?: 'local' | 'remote' | undefined;
  src: string;
  streamResolvedAt?: number;
}

export const REMOTE_STREAM_MAX_AGE_MS = 10 * 60 * 1000;

export function shouldRefreshRemoteStream(
  { source, src, streamResolvedAt }: RemoteStreamFreshnessState,
  now = Date.now(),
): boolean {
  if (source !== 'remote') return false;
  if (src.trim().length === 0) return true;
  if (!Number.isFinite(streamResolvedAt)) return true;
  return now - (streamResolvedAt as number) >= REMOTE_STREAM_MAX_AGE_MS;
}

export function shouldQueuePlaybackUntilReady({
  source,
  src,
  status,
}: PlaybackPreparationState): boolean {
  return status === 'loading' || (source === 'remote' && src.trim().length === 0);
}

export async function playAudioWithContext(
  audio: HTMLMediaElement,
  context: AudioContext | null,
): Promise<void> {
  // Both calls must happen in the original click task. Awaiting resume first
  // can consume Chromium's transient user activation and make the same click
  // fail with NotAllowedError, which looks like a "click twice" bug.
  const resumePromise = context?.state === 'suspended'
    ? context.resume()
    : Promise.resolve();
  const playPromise = audio.play();

  await Promise.all([resumePromise, playPromise]);
}
