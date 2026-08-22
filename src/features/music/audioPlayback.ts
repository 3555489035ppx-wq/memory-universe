interface PlaybackPreparationState {
  src: string;
  status: string;
}

export function shouldQueuePlaybackUntilReady({ src, status }: PlaybackPreparationState): boolean {
  return status === 'loading' || src.trim().length === 0;
}

export async function playAudioWithContext(
  audio: HTMLMediaElement,
  context: AudioContext | null,
): Promise<void> {
  // Start both calls in the original click task so browser user activation is
  // preserved for local system tracks and user uploads alike.
  const resumePromise = context?.state === 'suspended'
    ? context.resume()
    : Promise.resolve();
  const playPromise = audio.play();

  await Promise.all([resumePromise, playPromise]);
}
