/**
 * Converts sparse playback samples (for example HTMLMediaElement `timeupdate`)
 * into a continuous visual clock. The playback source remains authoritative;
 * this class only predicts the small gap until the next sample arrives.
 */
export class ContinuousTimelineProgress {
  private current: number;
  private target: number;
  private velocity: number;
  private lastSampleAt: number;
  private playing = false;

  public constructor(
    initialProgress: number,
    private readonly nominalRate: number,
    initialTimestamp = 0,
  ) {
    const initial = clamp(initialProgress);
    this.current = initial;
    this.target = initial;
    this.velocity = Math.max(0, nominalRate);
    this.lastSampleAt = initialTimestamp;
  }

  /** Synchronise an authoritative sample without forcing a visible jump. */
  public sync(progress: number, playing: boolean, timestamp: number): void {
    const sampled = clamp(progress);
    const elapsed = Math.max(1 / 240, timestamp - this.lastSampleAt);
    const rawDelta = sampled - this.target;
    // Media elements can emit a slightly older time after a decode stall or
    // source reconnect. Treat that tiny backward sample as clock noise while
    // playing; a real seek is still allowed through the larger threshold.
    const isSeek = Math.abs(rawDelta) > 0.035;
    const next = playing && rawDelta < 0 && !isSeek ? this.target : sampled;
    const delta = next - this.target;

    this.target = next;
    this.lastSampleAt = timestamp;
    this.playing = playing;

    if (isSeek || !playing) {
      this.current = next;
      this.velocity = playing ? Math.max(0, this.nominalRate) : 0;
      return;
    }

    const measuredVelocity = Math.max(0, delta / elapsed);
    const fallbackVelocity = Math.max(0, this.nominalRate);
    this.velocity = measuredVelocity > 0.00001
      ? this.velocity * 0.28 + measuredVelocity * 0.72
      : fallbackVelocity;
  }

  /** Advances using display time. Call once from requestAnimationFrame/useFrame. */
  public advance(timestamp: number, deltaSeconds: number): number {
    if (!this.playing) return this.current;
    const sampleAge = Math.max(0, timestamp - this.lastSampleAt);
    const projected = clamp(this.target + this.velocity * Math.min(sampleAge, 0.42));
    const safeDelta = Math.min(0.1, Math.max(0, deltaSeconds));
    // An 80ms critically damped response removes sample seams without making
    // the choreography feel delayed behind the music.
    const follow = 1 - Math.exp(-safeDelta / 0.08);
    this.current += (projected - this.current) * follow;
    return this.current;
  }

  public get value(): number {
    return this.current;
  }
}

function clamp(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}
