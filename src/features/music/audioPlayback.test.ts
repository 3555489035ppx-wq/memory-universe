import { describe, expect, it, vi } from 'vitest';

import {
  REMOTE_STREAM_MAX_AGE_MS,
  playAudioWithContext,
  shouldQueuePlaybackUntilReady,
  shouldRefreshRemoteStream,
} from './audioPlayback';

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
    const context = {
      state: 'suspended',
      resume,
    } as unknown as AudioContext;
    const audio = {
      play,
    } as unknown as HTMLMediaElement;

    await playAudioWithContext(audio, context);

    expect(calls).toEqual(['resume', 'play']);
    expect(resume).toHaveBeenCalledTimes(1);
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('does not wait for a suspended context before invoking media playback', async () => {
    let finishResume!: () => void;
    const resume = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishResume = resolve;
        }),
    );
    const play = vi.fn(() => Promise.resolve());
    const context = {
      state: 'suspended',
      resume,
    } as unknown as AudioContext;
    const audio = {
      play,
    } as unknown as HTMLMediaElement;

    const playback = playAudioWithContext(audio, context);

    expect(resume).toHaveBeenCalledTimes(1);
    expect(play).toHaveBeenCalledTimes(1);

    finishResume();
    await playback;
  });
});

describe('shouldQueuePlaybackUntilReady', () => {
  it('keeps the first click as pending intent while a remote stream is resolving', () => {
    expect(shouldQueuePlaybackUntilReady({
      source: 'remote',
      src: '',
      status: 'loading',
    })).toBe(true);
  });

  it('allows an already prepared remote stream to play immediately', () => {
    expect(shouldQueuePlaybackUntilReady({
      source: 'remote',
      src: 'http://127.0.0.1:3000/api/audio?url=ready',
      status: 'ready',
    })).toBe(false);
  });
});

describe('shouldRefreshRemoteStream', () => {
  const now = 1_786_441_600_000;

  it('refreshes legacy, missing, and expired remote playback URLs', () => {
    expect(shouldRefreshRemoteStream({ source: 'remote', src: '' }, now)).toBe(true);
    expect(shouldRefreshRemoteStream({ source: 'remote', src: 'legacy-url' }, now)).toBe(true);
    expect(shouldRefreshRemoteStream({
      source: 'remote',
      src: 'expired-url',
      streamResolvedAt: now - REMOTE_STREAM_MAX_AGE_MS,
    }, now)).toBe(true);
  });

  it('keeps fresh remote and local sources ready for immediate playback', () => {
    expect(shouldRefreshRemoteStream({
      source: 'remote',
      src: 'fresh-url',
      streamResolvedAt: now - 5_000,
    }, now)).toBe(false);
    expect(shouldRefreshRemoteStream({ source: 'local', src: 'blob:local' }, now)).toBe(false);
  });
});
