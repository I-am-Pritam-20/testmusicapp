import type {Song} from './types';
import type {TrackPayload} from '../native-kit/specs/NativeMusicPlayerModule';
import {colorExtractor} from './colorExtractor';

export interface AppTrack extends TrackPayload {
  bgColor?: string;
}

function bestQualityUrl(links: Array<{quality: string; url: string}> | undefined): string | undefined {
  if (!links || links.length === 0) return undefined;
  // JioSaavn's API lists these ascending by quality, so the last entry is highest.
  return links[links.length - 1]?.url;
}

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
    bgColor: colorExtractor.getFallbackColorSync(song.id),
  };
}

export function songsToTracks(songs: Song[]): AppTrack[] {
  return songs.map(songToTrack);
}

/** Async upgrade from the instant fallback color to the real extracted
 *  (native palette, or JS fallback if unavailable/failed) artwork color. */
export async function resolveTrackBgColor(track: AppTrack): Promise<string> {
  if (!track.artworkUrl) return track.bgColor ?? colorExtractor.getFallbackColorSync(track.id);
  try {
    return await colorExtractor.getDominantColor(track.artworkUrl);
  } catch {
    return track.bgColor ?? colorExtractor.getFallbackColorSync(track.id);
  }
}