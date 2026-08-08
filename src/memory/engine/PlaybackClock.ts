export interface PlaybackClockSnapshot {
  progress: number;
  currentTime: number;
  duration: number;
  status: 'idle' | 'playing' | 'paused' | 'completed';
}

export interface PlaybackClock {
  getSnapshot(): PlaybackClockSnapshot;
  play(): void;
  pause(): void;
  seek(progress: number): void;
  subscribe(listener: (snapshot: PlaybackClockSnapshot) => void): () => void;
  dispose(): void;
}
