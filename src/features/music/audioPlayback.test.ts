import { describe, expect, it, vi } from 'vitest';

import { playAudioWithContext, shouldQueuePlaybackUntilReady } from './audioPlayback';

describe('playAudioWithContext', () => {
  it('requests context resume and media playback from the same user gesture', async () => {
    const calls: string[] = [];
    const resume = vi.fn(() => {
      calls.push('resume');
      return Promise.resolve();
    });
    const play = vi.fn(() => {
      calls.push('play');
      return Promise.resolve();
    });
    const context = { state: 'suspended', resume } as unknown as AudioContext;
    const audio = { play } as unknown as HTMLMediaElement;

    await playAudioWithContext(audio, context);

    expect(calls).toEqual(['resume', 'play']);
    expect(resume).toHaveBeenCalledTimes(1);
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('does not wait for a suspended context before invoking media playback', async () => {
    let finishResume!: () => void;
    const resume = vi.fn(() => new Promise<void>((resolve) => {
      finishResume = resolve;
    }));
    const play = vi.fn(() => Promise.resolve());
    const context = { state: 'suspended', resume } as unknown as AudioContext;
    const audio = { play } as unknown as HTMLMediaElement;

    const playback = playAudioWithContext(audio, context);

    expect(resume).toHaveBeenCalledTimes(1);
    expect(play).toHaveBeenCalledTimes(1);
    finishResume();
    await playback;
  });
});

describe('shouldQueuePlaybackUntilReady', () => {
  it('keeps the first click pending while a bundled source is loading', () => {
    expect(shouldQueuePlaybackUntilReady({ src: '/music/high-school/song.mp3', status: 'loading' })).toBe(true);
  });

  it('does not delay a prepared system track or upload', () => {
    expect(shouldQueuePlaybackUntilReady({ src: '/music/high-school/song.mp3', status: 'ready' })).toBe(false);
    expect(shouldQueuePlaybackUntilReady({ src: 'blob:upload', status: 'ready' })).toBe(false);
  });
});
