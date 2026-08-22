import libraryEntries from './data/music-library.json';

import type { MusicTrack } from '../../stores/musicStore';

export interface MusicLibraryEntry {
  id: string;
  title: string;
  artist: string;
  category: string;
  duration?: number;
  url: string;
}

const baseUrl = import.meta.env.BASE_URL;

function resolveMusicUrl(url: string): string {
  return `${baseUrl}${url.replace(/^\/+/, '')}`;
}

export const MUSIC_LIBRARY_ENTRIES: readonly MusicLibraryEntry[] = libraryEntries as MusicLibraryEntry[];

export const SYSTEM_MUSIC_TRACKS: readonly MusicTrack[] = MUSIC_LIBRARY_ENTRIES.map((entry) => {
  const track: MusicTrack = {
    id: entry.id,
    name: entry.title,
    fileName: entry.url.split('/').pop() ?? `${entry.id}.mp3`,
    src: resolveMusicUrl(entry.url),
    source: 'system',
    artist: entry.artist,
    album: entry.category,
    category: entry.category,
  };
  return entry.duration === undefined ? track : { ...track, duration: entry.duration };
});

export const MUSIC_LIBRARY_TRACKS = SYSTEM_MUSIC_TRACKS;
