import {CacheService} from './CacheService';
import type {AppTrack} from './trackMapper';

/**
 * Everything here is purely local (MMKV, lifetime retention) — the
 * JioSaavn API has no accounts, so playlists/likes/follows have no
 * server-side counterpart at all. This is the sole source of truth for
 * them, independent of the home feed's 2-day cache.
 */

export interface LocalPlaylist {
  id: string;
  name: string;
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

export const LibraryService = {
  // --- Playlists -----------------------------------------------------------

  getPlaylists(): LocalPlaylist[] {
    return CacheService.getLibraryItem<LocalPlaylist[]>(PLAYLISTS_KEY) ?? [];
  },

  getPlaylist(id: string): LocalPlaylist | null {
    return LibraryService.getPlaylists().find(p => p.id === id) ?? null;
  },

  createPlaylist(name: string): LocalPlaylist {
    const playlist: LocalPlaylist = {
      id: generateId(),
      name,
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

  addTrackToPlaylist(id: string, track: AppTrack): void {
    const playlists = LibraryService.getPlaylists().map(p => {
      if (p.id !== id) return p;
      if (p.tracks.some(t => t.id === track.id)) return p;
      return {...p, tracks: [...p.tracks, track], updatedAt: Date.now()};
    });
    CacheService.setLibraryItem(PLAYLISTS_KEY, playlists);
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

  recordDownload(track: AppTrack, localPath: string): void {
    const downloads = LibraryService.getDownloads().filter(t => t.id !== track.id);
    CacheService.setLibraryItem(DOWNLOADS_KEY, [...downloads, {...track, localPath, downloadedAt: Date.now()}]);
  },

  removeDownload(id: string): void {
    CacheService.setLibraryItem(
      DOWNLOADS_KEY,
      LibraryService.getDownloads().filter(t => t.id !== id),
    );
  },
};
