import {createMMKV } from 'react-native-mmkv';

/**
 * Generic MMKV-backed cache with three independent retention policies:
 *  - Home feed: 2-day TTL, auto-expires, or force-refreshed via
 *    invalidateHomeFeed() (pull-to-refresh on the home screen).
 *  - Playback state: lifetime (survives app restarts, only cleared by
 *    clearPlaybackState() or the user clearing app data).
 *  - Library (playlists/liked songs/liked artists/downloads): lifetime,
 *    stored under its own key namespace so refreshing the home feed never
 *    touches it.
 */

const storage = createMMKV ({id: 'musickit-cache'});

const HOME_FEED_KEY = 'home_feed_v1';
const HOME_FEED_TTL_MS = 2 * 24 * 60 * 60 * 1000; // 2 days
const PLAYBACK_STATE_KEY = 'playback_state_v1';
const LIBRARY_KEY_PREFIX = 'library:';

interface CachedEnvelope<T> {
  cachedAt: number;
  data: T;
}

function readJSON<T>(key: string): T | null {
  const raw = storage.getString(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJSON(key: string, value: unknown): void {
  storage.set(key, JSON.stringify(value));
}

export const CacheService = {
  // --- Home feed (2-day retention) ---------------------------------------

  getHomeFeed<T>(): T | null {
    const envelope = readJSON<CachedEnvelope<T>>(HOME_FEED_KEY);
    if (!envelope) return null;
    if (Date.now() - envelope.cachedAt > HOME_FEED_TTL_MS) return null;
    return envelope.data;
  },

  setHomeFeed<T>(data: T): void {
    writeJSON(HOME_FEED_KEY, {cachedAt: Date.now(), data});
  },

  /** Force a refresh regardless of TTL — call on pull-to-refresh. */
  invalidateHomeFeed(): void {
    storage.remove(HOME_FEED_KEY);
  },

  // --- Playback state (lifetime, restored on reopen) ---------------------

  getPlaybackState<T>(): T | null {
    return readJSON<T>(PLAYBACK_STATE_KEY);
  },

  setPlaybackState(data: unknown): void {
    writeJSON(PLAYBACK_STATE_KEY, data);
  },

  clearPlaybackState(): void {
    storage.remove(PLAYBACK_STATE_KEY);
  },

  // --- Library (lifetime, independent of home feed refresh) --------------

  getLibraryItem<T>(key: string): T | null {
    return readJSON<T>(LIBRARY_KEY_PREFIX + key);
  },

  setLibraryItem(key: string, data: unknown): void {
    writeJSON(LIBRARY_KEY_PREFIX + key, data);
  },

  deleteLibraryItem(key: string): void {
    storage.remove(LIBRARY_KEY_PREFIX + key);
  },

  /** Wipes everything — home feed, playback state, and library. Wire this
   *  to a "Clear cache" button in Settings with a confirmation prompt. */
  clearAll(): void {
    storage.clearAll();
  },
};
