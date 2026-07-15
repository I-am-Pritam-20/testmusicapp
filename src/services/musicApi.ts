import type {
  Album,
  Artist,
  GlobalSearchResult,
  PagedResult,
  Playlist,
  Song,
} from './types';
import {API_BASE_URL} from '@env';

/**
 * Thin fetch-based client for the JioSaavn API (saavn.dev / self-hosted
 * forks of it). Every endpoint here matches the OpenAPI spec exactly —
 * see src/services/types.ts for the response shapes.
 */

// API_BASE_URL comes from .env at build time (react-native-dotenv) — see
// env.d.ts for the type declaration and babel.config.js for the plugin
// setup. Falls back to the public instance if .env is missing/empty.
const DEFAULT_BASE_URL = API_BASE_URL || 'https://saavn.sumit.co';

let baseUrl = DEFAULT_BASE_URL;

/** Runtime override on top of the .env default — e.g. from SettingsScreen,
 *  to point at a different instance without a rebuild. Only lasts for the
 *  current app session; wire it to CacheService/MMKV if you want it to
 *  persist across restarts. */
export function configureMusicApiBaseUrl(url: string): void {
  baseUrl = url.replace(/\/+$/, '');
}

export function getMusicApiBaseUrl(): string {
  return baseUrl;
}

class MusicApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'MusicApiError';
  }
}

async function apiGet<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
  // Built manually rather than via URL/URLSearchParams — React Native's
  // global URL polyfill has historically shipped incomplete method
  // coverage (`.set()` in particular isn't reliably present/typed), so
  // plain string building is the more portable choice here.
  const queryString = params
    ? Object.entries(params)
        .filter((entry): entry is [string, string | number | boolean] => entry[1] !== undefined)
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
        .join('&')
    : '';
  const url = queryString ? `${baseUrl}${path}?${queryString}` : `${baseUrl}${path}`;

  let response: Response;
  try {
    response = await fetch(url);
  } catch (e) {
    throw new MusicApiError(`Network error calling ${path}: ${(e as Error).message}`);
  }

  if (!response.ok) {
    throw new MusicApiError(`JioSaavn API error ${response.status} for ${path}`, response.status);
  }

  const json = await response.json();
  if (json?.success === false) {
    throw new MusicApiError(`JioSaavn API returned success:false for ${path}`);
  }
  return json.data as T;
}

// --- Search ----------------------------------------------------------------

export function globalSearch(query: string): Promise<GlobalSearchResult> {
  return apiGet('/api/search', {query});
}

export function searchSongs(query: string, page = 0, limit = 20): Promise<PagedResult<Song>> {
  return apiGet('/api/search/songs', {query, page, limit});
}

export function searchAlbums(query: string, page = 0, limit = 20) {
  return apiGet('/api/search/albums', {query, page, limit});
}

export function searchArtists(query: string, page = 0, limit = 20) {
  return apiGet('/api/search/artists', {query, page, limit});
}

export function searchPlaylists(query: string, page = 0, limit = 20) {
  return apiGet('/api/search/playlists', {query, page, limit});
}

// --- Songs -------------------------------------------------------------

export function getSongsByIds(ids: string[]): Promise<Song[]> {
  return apiGet('/api/songs', {ids: ids.join(',')});
}

export function getSongsByLink(link: string): Promise<Song[]> {
  return apiGet('/api/songs', {link});
}

export function getSongById(id: string): Promise<Song[]> {
  return apiGet(`/api/songs/${id}`);
}

export function getSongSuggestions(id: string, limit = 10): Promise<Song[]> {
  return apiGet(`/api/songs/${id}/suggestions`, {limit});
}

// --- Albums ------------------------------------------------------------

/** An explicit index signature is needed here (not just id?/link?) so this
 *  structurally satisfies apiGet's Record<string, ...> params type — a
 *  plain interface without one doesn't, even if every property happens to
 *  be string | undefined. */
interface IdOrLinkParams {
  id?: string;
  link?: string;
  [key: string]: string | number | boolean | undefined;
}

export function getAlbum(idOrLink: IdOrLinkParams): Promise<Album> {
  return apiGet('/api/albums', idOrLink);
}

// --- Artists -----------------------------------------------------------

export interface ArtistListOptions {
  page?: number;
  songCount?: number;
  albumCount?: number;
  sortBy?: 'popularity' | 'latest' | 'alphabetical';
  sortOrder?: 'asc' | 'desc';
  [key: string]: string | number | boolean | undefined;
}

export function getArtist(idOrLink: IdOrLinkParams & ArtistListOptions): Promise<Artist> {
  return apiGet('/api/artists', idOrLink);
}

export function getArtistById(id: string, options?: ArtistListOptions): Promise<Artist> {
  return apiGet(`/api/artists/${id}`, options);
}

interface ArtistContentOptions {
  page?: number;
  sortBy?: string;
  sortOrder?: string;
  [key: string]: string | number | boolean | undefined;
}

export function getArtistSongs(id: string, options?: ArtistContentOptions) {
  return apiGet(`/api/artists/${id}/songs`, options);
}

export function getArtistAlbums(id: string, options?: ArtistContentOptions) {
  return apiGet(`/api/artists/${id}/albums`, options);
}

// --- Playlists ---------------------------------------------------------

interface PlaylistParams extends IdOrLinkParams {
  page?: number;
  limit?: number;
}

export function getPlaylist(options: PlaylistParams): Promise<Playlist> {
  return apiGet('/api/playlists', options);
}

export {MusicApiError};