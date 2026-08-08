import type { PlaybackClock, PlaybackClockSnapshot } from './PlaybackClock';

export class FallbackPlaybackClock implements PlaybackClock {
  private snapshot: PlaybackClockSnapshot;
  private readonly listeners = new Set<(snapshot: PlaybackClockSnapshot) => void>();
  private animationFrame: number | null = null;
  private lastNow = 0;

  constructor(private readonly duration: number) {
    this.snapshot = { progress: 0, currentTime: 0, duration, status: 'idle' };
  }

  getSnapshot(): PlaybackClockSnapshot {
    return this.snapshot;
  }

  play(): void {
    if (this.snapshot.status === 'completed') this.seek(0);
    this.snapshot = { ...this.snapshot, status: 'playing' };
    this.lastNow = performance.now();
    this.emit();
    this.tick();
  }

  pause(): void {
    if (this.snapshot.status !== 'playing') return;
    this.snapshot = { ...this.snapshot, status: 'paused' };
    this.stopFrame();
    this.emit();
  }

  seek(progress: number): void {
    const nextProgress = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0));
    const status = nextProgress >= 1 ? 'completed' : this.snapshot.status === 'playing' ? 'playing' : 'paused';
    this.snapshot = {
      ...this.snapshot,
      progress: nextProgress,
      currentTime: this.duration * nextProgress,
      status,
    };
    this.lastNow = performance.now();
    this.emit();
    if (status === 'playing') this.tick();
  }

  subscribe(listener: (snapshot: PlaybackClockSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => this.listeners.delete(listener);
  }

  dispose(): void {
    this.stopFrame();
    this.listeners.clear();
  }

  private tick = (): void => {
    if (this.snapshot.status !== 'playing') return;
    const now = performance.now();
    const elapsed = Math.max(0, now - this.lastNow) / 1000;
    this.lastNow = now;
    const next = Math.min(1, this.snapshot.progress + elapsed / Math.max(0.001, this.duration));
    this.snapshot = { ...this.snapshot, progress: next, currentTime: next * this.duration };
    if (next >= 1) {
      this.snapshot = { ...this.snapshot, status: 'completed' };
      this.animationFrame = null;
      this.emit();
      return;
    }
    this.emit();
    this.animationFrame = requestAnimationFrame(this.tick);
  };

  private stopFrame(): void {
    if (this.animationFrame !== null) cancelAnimationFrame(this.animationFrame);
    this.animationFrame = null;
  }

  private emit(): void {
    for (const listener of this.listeners) listener(this.snapshot);
  }
}
