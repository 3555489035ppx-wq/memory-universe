import type { MusicTrack } from '../../stores/musicStore';
import { SYSTEM_MUSIC_TRACKS } from './musicLibrary';

/** Default soundtrack for the public high-school memory experience. */
export const HIGH_SCHOOL_DEMO_TRACK: MusicTrack = SYSTEM_MUSIC_TRACKS.find((track) => track.id === 'highschool_01') ?? {
  id: 'highschool_01',
  name: '特别的人',
  fileName: 'te-bie-de-ren-fang-datong.mp3',
  src: `${import.meta.env.BASE_URL}music/high-school/te-bie-de-ren-fang-datong.mp3`,
  source: 'system',
  artist: '方大同',
  album: '高中回忆',
  category: '高中回忆',
  duration: 259,
};

/** All public demo tracks are read from the generated system library. */
export const DEMO_MUSIC_TRACKS: readonly MusicTrack[] = SYSTEM_MUSIC_TRACKS;
