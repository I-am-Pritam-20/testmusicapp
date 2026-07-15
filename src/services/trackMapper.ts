import type {Song} from './types';
import type {TrackPayload} from '../native-kit/specs/NativeMusicPlayerModule';

/** JS-only display field on top of the native TrackPayload contract —
 *  never sent to native beyond the base fields it already satisfies.
 *  This replaces the AppTrack type that used to live in data.ts. */
export interface AppTrack extends TrackPayload {
  bgColor?: string;
}

// A small tasteful palette, picked deterministically per track id so the
// same song always gets the same background tint (no image-color
// extraction library — that's a separate scope if you want it later).
const BG_PALETTE = ['#333131', '#1d3672', '#5c2a4d', '#2a5c3f', '#5c4a2a', '#2a405c', '#4a2a5c', '#5c2a2a'];

function pickBgColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return BG_PALETTE[Math.abs(hash) % BG_PALETTE.length];
}

function bestQualityUrl(links: Array<{quality: string; url: string}> | undefined): string | undefined {
  if (!links || links.length === 0) return undefined;
  // JioSaavn's API lists these ascending by quality, so the last entry is highest.
  return links[links.length - 1]?.url;
}

/** Converts an API Song into the shape MusicPlayer.setQueue/addToQueue need. */
export function songToTrack(song: Song): AppTrack {
  const artistNames =
    song.artists?.primary?.map(a => a.name).join(', ') ||
    song.artists?.all?.map(a => a.name).join(', ') ||
    'Unknown Artist';

  return {
    id: song.id,
    url: bestQualityUrl(song.downloadUrl) ?? '',
    sourceType: 'jiosaavn',
    title: song.name,
    artist: artistNames,
    artworkUrl: bestQualityUrl(song.image),
    durationMs: song.duration ? Number(song.duration) * 1000 : undefined,
    bgColor: pickBgColor(song.id),
  };
}

export function songsToTracks(songs: Song[]): AppTrack[] {
  return songs.map(songToTrack);
}
