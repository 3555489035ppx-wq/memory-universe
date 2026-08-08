import { beforeEach, describe, expect, it } from 'vitest';

import { useMemoryTemplateStore } from '../../stores/memoryTemplateStore';
import { FallbackPlaybackClock } from './FallbackPlaybackClock';
import { MemoryPlaybackCoordinator } from './MemoryPlaybackCoordinator';

describe('memory playback coordinator', () => {
  beforeEach(() => useMemoryTemplateStore.getState().exit());

  it('keeps the template store on the single clock and mirrors completion', () => {
    const store = useMemoryTemplateStore.getState();
    store.prepare({ templateId: 'high-school', source: 'demo', memoryIds: ['a', 'b', 'c'] });
    const clock = new FallbackPlaybackClock(48);
    const coordinator = new MemoryPlaybackCoordinator(clock, 'high-school');
    coordinator.connect();

    clock.seek(0.4);
    expect(useMemoryTemplateStore.getState().session?.progress).toBe(0.4);
    clock.seek(1);
    expect(useMemoryTemplateStore.getState().session).toMatchObject({ progress: 1, status: 'completed' });

    coordinator.disconnect();
  });
});
