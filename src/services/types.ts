/**
 * Types matching the JioSaavn API (saavn.dev) response shapes, extracted
 * directly from its OpenAPI spec rather than guessed — the `Song` shape in
 * particular is identical across search results, album songs, playlist
 * songs, and artist top songs, so it's defined once and reused everywhere.
 */

export interface ImageLink {
  quality: string;
  url: string;
}

export interface DownloadLink {
  quality: string;
  url: string;
}

export interface ArtistMini {
  id: string;
  name: string;
  role: string;
  type: string;
  image: ImageLink[];
  url: string;
}

export interface SongAlbumRef {
  id: string | null;
  name: string | null;
  url: string | null;
}

export interface Song {
  id: string;
  name: string;
  type: string;
  year: string | null;
  releaseDate: string | null;
  duration: string | number | null;
  label: string | null;
  explicitContent: boolean;
  playCount: number | null;
  language: string;
  hasLyrics: boolean;
  lyricsId: string | null;
  url: string;
  copyright: string | null;
  album: SongAlbumRef;
  artists: {
    primary: ArtistMini[];
    featured: ArtistMini[];
    all: ArtistMini[];
  };
  image: ImageLink[];
  downloadUrl: DownloadLink[];
}

export interface AlbumSearchResult {
  id: string;
  title: string;
  image: ImageLink[];
  artist: string;
  url: string;
  type: string;
  description: string;
  year: string;
  language: string;
  songIds: string;
}

export interface Album {
  id: string;
  name: string;
  description: string;
  year: string;
  type: string;
  playCount: number | null;
  language: string;
  explicitContent: boolean;
  artists: {primary: ArtistMini[]; featured: ArtistMini[]; all: ArtistMini[]};
  songCount: number | null;
  url: string;
  image: ImageLink[];
  songs: Song[];
}

export interface ArtistSearchResult {
  id: string;
  name: string;
  role: string;
  type: string;
  image: ImageLink[];
  url: string;
}

export interface Artist {
  id: string;
  name: string;
  url: string;
  type: string;
  image: ImageLink[];
  followerCount: number | null;
  fanCount: string | null;
  isVerified: boolean;
  dominantLanguage: string;
  dominantType: string;
  bio: unknown;
  dob: string | null;
  fb: string | null;
  twitter: string | null;
  wiki: string | null;
  availableLanguages: string[];
  isRadioPresent: boolean;
  topSongs: Song[];
  topAlbums: Album[];
  singles: Song[];
  similarArtists: ArtistSearchResult[];
}

export interface PlaylistSearchResult {
  id: string;
  name: string;
  type: string;
  image: ImageLink[];
  url: string;
  songCount: number | null;
  language: string;
  explicitContent: boolean;
}

export interface Playlist {
  id: string;
  name: string;
  description: string;
  year: string | null;
  type: string;
  playCount: number | null;
  language: string;
  explicitContent: boolean;
  songCount: number | null;
  url: string;
  image: ImageLink[];
  songs: Song[];
  artists: ArtistMini[] | null;
}

export interface PagedResult<T> {
  total: number;
  start: number;
  results: T[];
}

export interface GlobalSearchResult {
  albums: {results: AlbumSearchResult[]; position: number};
  songs: {results: Song[]; position: number};
  artists: {results: ArtistSearchResult[]; position: number};
  playlists: {results: PlaylistSearchResult[]; position: number};
  topQuery: {results: unknown[]; position: number};
}
