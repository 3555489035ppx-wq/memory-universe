import { beforeEach, describe, expect, it } from 'vitest';

import { useMemoryTemplateStore } from './memoryTemplateStore';

describe('memory template store', () => {
  beforeEach(() => useMemoryTemplateStore.getState().exit());

  it('prepares a real session and runs preview, pause, seek, replay and exit', () => {
    const store = useMemoryTemplateStore.getState();
    const memoryIds = Array.from({ length: 24 }, (_, index) => `memory-${String(index)}`);
    store.prepare({ templateId: 'high-school', source: 'demo', memoryIds });
    expect(useMemoryTemplateStore.getState().session).toMatchObject({ status: 'preview', memoryIds, heroPhotoId: 'memory-12' });

    store.start();
    expect(useMemoryTemplateStore.getState().session?.status).toBe('playing');
    store.setProgress(0.28);
    store.pause();
    expect(useMemoryTemplateStore.getState().session).toMatchObject({ status: 'paused', progress: 0.28 });
    store.seek(0.75);
    expect(useMemoryTemplateStore.getState().session?.progress).toBe(0.75);
    store.complete();
    store.seek(1);
    expect(useMemoryTemplateStore.getState().session).toMatchObject({ status: 'completed', progress: 1 });
    store.replay();
    expect(useMemoryTemplateStore.getState().session).toMatchObject({ status: 'playing', progress: 0 });
    store.exit();
    expect(useMemoryTemplateStore.getState().session).toBeNull();
  });

  it('rejects a session when it has no photos', () => {
    useMemoryTemplateStore.getState().prepare({ templateId: 'high-school', source: 'personal', memoryIds: [] });
    expect(useMemoryTemplateStore.getState().session).toMatchObject({ status: 'error', progress: 0 });
  });
});
