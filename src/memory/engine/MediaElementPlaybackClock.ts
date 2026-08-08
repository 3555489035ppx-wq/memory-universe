import type { PlaybackClock, PlaybackClockSnapshot } from './PlaybackClock';

export class MediaElementPlaybackClock implements PlaybackClock {
  private readonly listeners = new Set<(snapshot: PlaybackClockSnapshot) => void>();
  private disposed = false;

  constructor(private readonly audio: HTMLAudioElement, private readonly durationFallback: number) {
    for (const event of ['timeupdate', 'durationchange', 'play', 'pause', 'ended', 'error']) {
      audio.addEventListener(event, this.emit);
    }
  }

  getSnapshot(): PlaybackClockSnapshot {
    const duration = Number.isFinite(this.audio.duration) && this.audio.duration > 0 ? this.audio.duration : this.durationFallback;
    const currentTime = Math.max(0, this.audio.currentTime || 0);
    return {
      progress: Math.min(1, currentTime / Math.max(0.001, duration)),
      currentTime,
      duration,
      status: this.audio.ended ? 'completed' : this.audio.paused ? 'paused' : 'playing',
    };
  }

  play(): void {
    void this.audio.play().catch(() => undefined);
  }

  pause(): void {
    this.audio.pause();
  }

  seek(progress: number): void {
    const snapshot = this.getSnapshot();
    this.audio.currentTime = Math.min(1, Math.max(0, progress)) * snapshot.duration;
    this.emit();
  }

  subscribe(listener: (snapshot: PlaybackClockSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => this.listeners.delete(listener);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const event of ['timeupdate', 'durationchange', 'play', 'pause', 'ended', 'error']) {
      this.audio.removeEventListener(event, this.emit);
    }
    this.listeners.clear();
  }

  private emit = (): void => {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) listener(snapshot);
  };
}
