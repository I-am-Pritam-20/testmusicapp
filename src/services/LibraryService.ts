import {CacheService} from './CacheService';
import type {AppTrack} from './trackMapper';

/**
 * Everything here is purely local (MMKV, lifetime retention) — the
 * JioSaavn API has no accounts, so playlists/likes/follows have no
 * server-side counterpart at all. This is the sole source of truth for
 * them, independent of the home feed's 2-day cache.
 *
 * Online/offline playlist split: a playlist is created as either
 * 'online' or 'offline' and can never hold tracks from the other world
 * — see playlistTypeForTrack() and addTrackToPlaylist() below.
 */

export type PlaylistType = 'online' | 'offline';

export interface LocalPlaylist {
  id: string;
  name: string;
  type: PlaylistType;
  createdAt: number;
  updatedAt: number;
  tracks: AppTrack[];
}

export interface LikedArtist {
  id: string;
  name: string;
  imageUrl?: string;
}

export interface DownloadedTrack extends AppTrack {
  localPath: string;
  downloadedAt: number;
}

const PLAYLISTS_KEY = 'playlists';
const LIKED_SONGS_KEY = 'liked_songs';
const LIKED_ARTISTS_KEY = 'liked_artists';
const DOWNLOADS_KEY = 'downloads';

function generateId(): string {
  return `pl_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/** A track only ever belongs to one playlist "world": anything backed by
 *  a real local file (device-scanned, or downloaded and re-tagged by
 *  recordDownload below) is 'offline'; anything still streamed from
 *  JioSaavn is 'online'. */
export function playlistTypeForTrack(track: AppTrack): PlaylistType {
  return track.sourceType === 'local' ? 'offline' : 'online';
}

export const LibraryService = {
  // --- Playlists -----------------------------------------------------------

  getPlaylists(): LocalPlaylist[] {
    return CacheService.getLibraryItem<LocalPlaylist[]>(PLAYLISTS_KEY) ?? [];
  },

  /** Playlists narrowed to one world — pass 'offline' while the device has
   *  no connectivity so online-only playlists don't show as enterable. */
  getPlaylistsByType(type: PlaylistType): LocalPlaylist[] {
    return LibraryService.getPlaylists().filter(p => p.type === type);
  },

  getPlaylist(id: string): LocalPlaylist | null {
    return LibraryService.getPlaylists().find(p => p.id === id) ?? null;
  },

  isDuplicatePlaylistName(name: string): boolean {
    const trimmed = name.trim().toLowerCase();
    return LibraryService.getPlaylists().some(p => p.name.trim().toLowerCase() === trimmed);
  },

  createPlaylist(name: string, type: PlaylistType): LocalPlaylist {
    const playlist: LocalPlaylist = {
      id: generateId(),
      name,
      type,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tracks: [],
    };
    CacheService.setLibraryItem(PLAYLISTS_KEY, [...LibraryService.getPlaylists(), playlist]);
    return playlist;
  },

  renamePlaylist(id: string, name: string): void {
    const playlists = LibraryService.getPlaylists().map(p =>
      p.id === id ? {...p, name, updatedAt: Date.now()} : p,
    );
    CacheService.setLibraryItem(PLAYLISTS_KEY, playlists);
  },

  removePlaylist(id: string): void {
    CacheService.setLibraryItem(
      PLAYLISTS_KEY,
      LibraryService.getPlaylists().filter(p => p.id !== id),
    );
  },

  /** Returns false (no mutation) when the track's world doesn't match the
   *  playlist's — an online JioSaavn track can never land inside an
   *  offline playlist and vice versa. Call sites must check the return
   *  value and surface a toast/alert rather than assuming success. */
  addTrackToPlaylist(id: string, track: AppTrack): boolean {
    const playlist = LibraryService.getPlaylist(id);
    if (!playlist) return false;
    if (playlistTypeForTrack(track) !== playlist.type) return false;
    if (playlist.tracks.some(t => t.id === track.id)) return true; // already present, not an error
    const playlists = LibraryService.getPlaylists().map(p =>
      p.id === id ? {...p, tracks: [...p.tracks, track], updatedAt: Date.now()} : p,
    );
    CacheService.setLibraryItem(PLAYLISTS_KEY, playlists);
    return true;
  },

  removeTrackFromPlaylist(id: string, trackId: string): void {
    const playlists = LibraryService.getPlaylists().map(p =>
      p.id === id ? {...p, tracks: p.tracks.filter(t => t.id !== trackId), updatedAt: Date.now()} : p,
    );
    CacheService.setLibraryItem(PLAYLISTS_KEY, playlists);
  },

  // --- Liked songs -----------------------------------------------------------

  getLikedSongs(): AppTrack[] {
    return CacheService.getLibraryItem<AppTrack[]>(LIKED_SONGS_KEY) ?? [];
  },

  isSongLiked(id: string): boolean {
    return LibraryService.getLikedSongs().some(t => t.id === id);
  },

  /** Returns the new liked state (true = now liked). */
  toggleLikedSong(track: AppTrack): boolean {
    const liked = LibraryService.getLikedSongs();
    const exists = liked.some(t => t.id === track.id);
    const next = exists ? liked.filter(t => t.id !== track.id) : [...liked, track];
    CacheService.setLibraryItem(LIKED_SONGS_KEY, next);
    return !exists;
  },

  // --- Liked/followed artists (custom — the API has no concept of this) ---

  getLikedArtists(): LikedArtist[] {
    return CacheService.getLibraryItem<LikedArtist[]>(LIKED_ARTISTS_KEY) ?? [];
  },

  isArtistFollowed(id: string): boolean {
    return LibraryService.getLikedArtists().some(a => a.id === id);
  },

  toggleFollowedArtist(artist: LikedArtist): boolean {
    const artists = LibraryService.getLikedArtists();
    const exists = artists.some(a => a.id === artist.id);
    const next = exists ? artists.filter(a => a.id !== artist.id) : [...artists, artist];
    CacheService.setLibraryItem(LIKED_ARTISTS_KEY, next);
    return !exists;
  },

  // --- Downloaded songs ----------------------------------------------------
  // The registry (this) is JS/MMKV; the actual file bytes are written
  // natively — see MusicPlayer.downloadTrack in native-kit.

  getDownloads(): DownloadedTrack[] {
    return CacheService.getLibraryItem<DownloadedTrack[]>(DOWNLOADS_KEY) ?? [];
  },

  isDownloaded(id: string): boolean {
    return LibraryService.getDownloads().some(t => t.id === id);
  },

  /** Downloaded tracks are re-tagged sourceType:'local' and pointed at the
   *  on-disk file — once downloaded, a song behaves exactly like a
   *  device-scanned file: offline-eligible, shows up in offline
   *  search/library, and can only join offline playlists. */
  recordDownload(track: AppTrack, localPath: string): void {
    const downloads = LibraryService.getDownloads().filter(t => t.id !== track.id);
    const offlineTrack: DownloadedTrack = {
      ...track,
      sourceType: 'local',
      url: localPath,
      localPath,
      downloadedAt: Date.now(),
    };
    CacheService.setLibraryItem(DOWNLOADS_KEY, [...downloads, offlineTrack]);
  },

  removeDownload(id: string): void {
    CacheService.setLibraryItem(
      DOWNLOADS_KEY,
      LibraryService.getDownloads().filter(t => t.id !== id),
    );
  },
};
