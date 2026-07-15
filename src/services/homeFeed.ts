import {globalSearch, getSongSuggestions} from './musicApi';
import type {AlbumSearchResult, ArtistSearchResult, PlaylistSearchResult, Song} from './types';
import {CacheService} from './CacheService';

/**
 * There's no home/discovery endpoint in this API at all, so the feed is
 * assembled from three blended strategies, per product decision:
 *  1. Curated queries — a fixed pool of editorial search terms.
 *  2. Rotating queries — a larger pool of genre/mood terms, a random
 *     subset of which is shown each refresh (this is the "shuffling
 *     sections" part).
 *  3. Recently-played-driven — song suggestions seeded from whatever the
 *     user actually listened to most recently, when there's history.
 * "Refresh" means: re-run this whole assembly and re-roll the shuffled
 * subset — driven by CacheService's 2-day TTL or a manual pull-to-refresh.
 */

export type HomeSectionKind = 'songs' | 'albums' | 'playlists' | 'artists';

export interface HomeSection {
  id: string;
  title: string;
  kind: HomeSectionKind;
  items: Array<Song | AlbumSearchResult | PlaylistSearchResult | ArtistSearchResult>;
}

export interface HomeFeed {
  sections: HomeSection[];
}

// Pool 1: always-shown editorial sections.
const CURATED_QUERIES: Array<{title: string; query: string; kind: HomeSectionKind}> = [
  {title: "Today's Hits", query: 'top hits', kind: 'songs'},
  {title: 'Popular Albums', query: 'top albums', kind: 'albums'},
];

// Pool 2: a larger set of genre/mood queries — a random subset of these
// is picked and shuffled into the feed on every refresh.
const ROTATING_QUERIES: Array<{title: string; query: string; kind: HomeSectionKind}> = [
  {title: 'Bollywood Party', query: 'bollywood party', kind: 'playlists'},
  {title: '90s Bollywood', query: '90s bollywood', kind: 'playlists'},
  {title: 'Workout', query: 'workout', kind: 'playlists'},
  {title: 'Chill Vibes', query: 'chill', kind: 'playlists'},
  {title: 'Romantic Hits', query: 'romantic', kind: 'songs'},
  {title: 'Arijit Singh', query: 'arijit singh', kind: 'artists'},
  {title: 'Sad Songs', query: 'sad songs', kind: 'songs'},
  {title: 'Indie Picks', query: 'indie', kind: 'albums'},
  {title: 'Devotional', query: 'bhajan', kind: 'playlists'},
  {title: 'Classic Rock', query: 'classic rock', kind: 'albums'},
];

const ROTATING_SECTION_COUNT = 4;

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

async function buildQuerySection(def: {title: string; query: string; kind: HomeSectionKind}): Promise<HomeSection | null> {
  try {
    const result = await globalSearch(def.query);
    const items =
      def.kind === 'songs'
        ? result.songs.results
        : def.kind === 'albums'
          ? result.albums.results
          : def.kind === 'playlists'
            ? result.playlists.results
            : result.artists.results;
    if (!items || items.length === 0) return null;
    return {id: def.query, title: def.title, kind: def.kind, items};
  } catch {
    return null; // one failed section shouldn't break the whole feed
  }
}

async function buildRecentlyPlayedSection(recentTrackIds: string[]): Promise<HomeSection | null> {
  if (recentTrackIds.length === 0) return null;
  try {
    const suggestions = await getSongSuggestions(recentTrackIds[0], 15);
    if (!suggestions || suggestions.length === 0) return null;
    return {id: 'recommended-for-you', title: 'Recommended for You', kind: 'songs', items: suggestions};
  } catch {
    return null;
  }
}

/** `recentTrackIds` should be the most-recently-played track ids first
 *  (from PlaybackQueueContext's history), used to seed a "Recommended for
 *  You" section. Pass an empty array if there's no listening history yet. */
export async function buildHomeFeed(recentTrackIds: string[]): Promise<HomeFeed> {
  const rotatingSubset = shuffle(ROTATING_QUERIES).slice(0, ROTATING_SECTION_COUNT);
  const defs = [...CURATED_QUERIES, ...rotatingSubset];

  const [recommended, ...querySections] = await Promise.all([
    buildRecentlyPlayedSection(recentTrackIds),
    ...defs.map(buildQuerySection),
  ]);

  const sections = [recommended, ...querySections].filter((s): s is HomeSection => s != null);
  return {sections};
}

/** Returns cached feed if fresh (<2 days), otherwise fetches + caches a new one. */
export async function getHomeFeed(recentTrackIds: string[]): Promise<HomeFeed> {
  const cached = CacheService.getHomeFeed<HomeFeed>();
  if (cached) return cached;
  const feed = await buildHomeFeed(recentTrackIds);
  CacheService.setHomeFeed(feed);
  return feed;
}

/** Ignores the cache entirely — call on pull-to-refresh. */
export async function refreshHomeFeed(recentTrackIds: string[]): Promise<HomeFeed> {
  CacheService.invalidateHomeFeed();
  const feed = await buildHomeFeed(recentTrackIds);
  CacheService.setHomeFeed(feed);
  return feed;
}
