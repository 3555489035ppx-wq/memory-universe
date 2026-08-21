import type { MusicTrack } from '../../stores/musicStore';

/**
 * A deterministic, local-only soundtrack used by the interview/demo path.
 * It deliberately does not pretend to be a third-party account session.
 */
export const HIGH_SCHOOL_DEMO_TRACK: MusicTrack = {
  id: 'demo-high-school-soundtrack',
  name: '那年夏天 · 记忆宇宙 Demo',
  fileName: 'demo-soundtrack.wav',
  src: `${import.meta.env.BASE_URL}demo/demo-soundtrack.wav`,
  source: 'local',
  artist: 'Memuniverse Studio',
  album: '高中回忆 Demo',
  duration: 180,
};
