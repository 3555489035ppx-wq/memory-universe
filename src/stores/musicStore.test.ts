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
});
