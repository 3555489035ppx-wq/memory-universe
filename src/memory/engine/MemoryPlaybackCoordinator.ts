import type { MemoryTemplateId } from '../types';
import type { PlaybackClock } from './PlaybackClock';
import { useMemoryTemplateStore } from '../../stores/memoryTemplateStore';

export class MemoryPlaybackCoordinator {
  private unsubscribe: (() => void) | null = null;

  constructor(private readonly clock: PlaybackClock, private readonly templateId: MemoryTemplateId) {}

  connect(): void {
    this.unsubscribe = this.clock.subscribe((snapshot) => {
      const session = useMemoryTemplateStore.getState().session;
      if (!session || session.templateId !== this.templateId) return;
      useMemoryTemplateStore.getState().setProgress(snapshot.progress);
      if (snapshot.status === 'completed') useMemoryTemplateStore.getState().complete();
    });
  }

  disconnect(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.clock.dispose();
  }
}
