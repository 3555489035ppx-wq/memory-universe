import { beforeEach, describe, expect, it } from 'vitest';

import { useMusicStore } from './musicStore';

describe('music store', () => {
  beforeEach(() => {
    const state = useMusicStore.getState();
    state.setTrack(null);
    state.setQueue([]);
    state.setStatus('idle');
    state.setProgress(0, 0);
    state.setVolume(0.72);
    state.setAutoMix(false);
    state.setFadeInDuration(0.46);
    state.setFadeOutDuration(0.42);
    state.setAudioEnhancement(true);
    state.resetLyricOffset();
    while (useMusicStore.getState().playbackMode !== 'queue') useMusicStore.getState().cyclePlaybackMode();
    state.setSpectrum({ energy: 0, bass: 0, mid: 0, treble: 0, beat: 0 });
    state.setConsoleOpen(false);
  });

  it('keeps local track metadata and resets progress when a new track is selected', () => {
    useMusicStore.getState().setProgress(18, 120);
    useMusicStore.getState().setTrack({
      id: 'alarm',
      name: 'Alarm01',
      fileName: 'Alarm01.wav',
      src: 'blob:alarm',
    });

    expect(useMusicStore.getState()).toMatchObject({
      track: { id: 'alarm', name: 'Alarm01' },
      status: 'ready',
      currentTime: 0,
      duration: 0,
    });
  });

  it('clamps volume to the browser-safe range', () => {
    useMusicStore.getState().setVolume(2);
    expect(useMusicStore.getState().volume).toBe(1);
    useMusicStore.getState().setVolume(-1);
    expect(useMusicStore.getState().volume).toBe(0);
  });

  it('keeps a remote playlist as a playable queue', () => {
    const queue = [
      {
        id: 'netease:one',
        remoteId: 'one',
        name: 'One',
        fileName: 'One',
        src: '',
        source: 'remote' as const,
        provider: 'netease' as const,
      },
      {
        id: 'netease:two',
        remoteId: 'two',
        name: 'Two',
        fileName: 'Two',
        src: '',
        source: 'remote' as const,
        provider: 'netease' as const,
      },
    ];

    useMusicStore.getState().playQueueTrack(queue, 1);

    expect(useMusicStore.getState()).toMatchObject({
      queueIndex: 1,
      track: { id: 'netease:two', source: 'remote', provider: 'netease' },
      status: 'ready',
    });
  });

  it('updates the active track and queued copy with a fresh remote stream', () => {
    const queue = [{
      id: 'netease:fresh',
      remoteId: 'fresh',
      name: 'Fresh',
      fileName: 'Fresh',
      src: '',
      source: 'remote' as const,
      provider: 'netease' as const,
    }];
    const resolvedAt = 1_786_441_600_000;

    useMusicStore.getState().playQueueTrack(queue, 0);
    useMusicStore.getState().setTrackSource('netease:fresh', 'http://127.0.0.1:3000/api/audio?url=fresh', resolvedAt);

    expect(useMusicStore.getState().track).toMatchObject({
      src: 'http://127.0.0.1:3000/api/audio?url=fresh',
      streamResolvedAt: resolvedAt,
    });
    expect(useMusicStore.getState().queue[0]).toMatchObject({
      src: 'http://127.0.0.1:3000/api/audio?url=fresh',
      streamResolvedAt: resolvedAt,
    });
  });

  it('preserves local ownership when a local track is queued', () => {
    const queue = [
      {
        id: 'local:one',
        name: 'Local one',
        fileName: 'one.mp3',
        src: 'blob:one',
        source: 'local' as const,
      },
    ];

    useMusicStore.getState().playQueueTrack(queue, 0);

    expect(useMusicStore.getState().track).toMatchObject({ id: 'local:one', source: 'local', src: 'blob:one' });
  });

  it('cycles playback modes and clamps playback preferences', () => {
    const state = useMusicStore.getState();
    expect(state.playbackMode).toBe('queue');
    state.cyclePlaybackMode();
    expect(useMusicStore.getState().playbackMode).toBe('repeat');
    state.cyclePlaybackMode();
    expect(useMusicStore.getState().playbackMode).toBe('shuffle');
    state.cyclePlaybackMode();
    expect(useMusicStore.getState().playbackMode).toBe('queue');

    state.setFadeInDuration(8);
    state.setFadeOutDuration(-1);
    state.setLyricOffset(99);
    expect(useMusicStore.getState()).toMatchObject({ fadeInDuration: 3, fadeOutDuration: 0, lyricOffset: 10 });
  });

  it('keeps the versioned audio preset and legacy enhancement flag consistent', () => {
    const state = useMusicStore.getState();
    state.setAudioPreset('studio-master-v1');
    expect(useMusicStore.getState()).toMatchObject({
      audioPreset: 'studio-master-v1',
      audioEnhancement: true,
    });
    state.setAudioEnhancement(false);
    expect(useMusicStore.getState()).toMatchObject({
      audioPreset: 'original',
      audioEnhancement: false,
    });
  });

  it('adds tracks once and moves a queued track directly after the current song', () => {
    const tracks = ['one', 'two', 'three'].map((id) => ({
      id,
      name: id,
      fileName: `${id}.mp3`,
      src: `blob:${id}`,
      source: 'local' as const,
    }));
    const [one, two, three] = tracks;
    if (!one || !two || !three) throw new Error('test track fixtures are incomplete');
    const state = useMusicStore.getState();
    state.playQueueTrack([one, two, three], 0);
    state.enqueueTrack(two);
    state.enqueueTrack(two);
    state.enqueueTrack(three);
    expect(useMusicStore.getState().queue.map((track) => track.id)).toEqual(['one', 'two', 'three']);
    state.moveQueueTrackNext(2);
    expect(useMusicStore.getState().queue.map((track) => track.id)).toEqual(['one', 'three', 'two']);
    state.removeQueueTrack(1);
    expect(useMusicStore.getState().queue.map((track) => track.id)).toEqual(['one', 'two']);
  });
});
