import type { MemoryTemplateId } from '../types';
import type { PlaybackClock } from './PlaybackClock';
import { useMemoryTemplateStore } from '../../stores/memoryTemplateStore';

export class MemoryPlaybackCoordinator {
  private unsubscribe: (() => void) | null = null;
  private lastPublishedAt = -Infinity;
  private lastPublishedProgress = -1;

  constructor(private readonly clock: PlaybackClock, private readonly templateId: MemoryTemplateId) {}

  connect(): void {
    this.unsubscribe = this.clock.subscribe((snapshot) => {
      const session = useMemoryTemplateStore.getState().session;
      if (!session || session.templateId !== this.templateId) return;
      const now = typeof performance === 'undefined' ? Date.now() : performance.now();
      const statusChanged = snapshot.status === 'completed' || snapshot.status === 'paused' || snapshot.status === 'idle';
      const directSeek = Math.abs(snapshot.progress - this.lastPublishedProgress) >= 0.035;
      const cadenceElapsed = now - this.lastPublishedAt >= 80;
      if (statusChanged || directSeek || cadenceElapsed) {
        useMemoryTemplateStore.getState().setProgress(snapshot.progress);
        this.lastPublishedAt = now;
        this.lastPublishedProgress = snapshot.progress;
      }
      if (snapshot.status === 'completed') useMemoryTemplateStore.getState().complete();
    });
  }

  disconnect(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.clock.dispose();
  }
}
