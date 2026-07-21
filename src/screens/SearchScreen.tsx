import React, {useRef, useState} from 'react';
import {ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, TextInput, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../navigation/RootNavigator';
import {globalSearch, searchAlbums, searchArtists, searchPlaylists, searchSongs} from '../services/musicApi';
import {songsToTracks, type AppTrack} from '../services/trackMapper';
import {DeviceLibraryService} from '../services/DeviceLibraryService';
import {LibraryService} from '../services/LibraryService';
import {usePlaybackQueue} from '../context/PlaybackQueueContext';
import {useNetworkStatus} from '../components/NetworkStatusProvider';
import type {
  AlbumSearchResult,
  ArtistSearchResult,
  GlobalSearchResult,
  ImageLink,
  PlaylistSearchResult,
  Song,
} from '../services/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type FilterKey = 'all' | 'songs' | 'albums' | 'artists' | 'playlists';

const FILTERS: Array<{key: FilterKey; label: string}> = [
  {key: 'all', label: 'All'},
  {key: 'songs', label: 'Songs'},
  {key: 'albums', label: 'Albums'},
  {key: 'artists', label: 'Artists'},
  {key: 'playlists', label: 'Playlists'},
];

const DEBOUNCE_MS = 350;

function bestImage(images: ImageLink[] | undefined): string | undefined {
  return images && images.length > 0 ? images[images.length - 1].url : undefined;
}

/** A song can only ever come from one of these two rows — a downloaded
 *  track keeps its original id, so if it matches both a local scan and
 *  the online API it's deduped down to a single 'local' row (it's
 *  playable offline right now, which is the more useful thing to show). */
type Row =
  | {kind: 'song'; item: Song; songsForQueue: Song[]; queueIndex: number}
  | {kind: 'local-song'; item: AppTrack; tracksForQueue: AppTrack[]; queueIndex: number}
  | {kind: 'album'; item: AlbumSearchResult}
  | {kind: 'artist'; item: ArtistSearchResult}
  | {kind: 'playlist'; item: PlaylistSearchResult};

function searchLocalTracks(query: string): AppTrack[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const deviceTracks = DeviceLibraryService.getFiles().map(f => DeviceLibraryService.toAppTrack(f));
  const downloadTracks: AppTrack[] = LibraryService.getDownloads();
  const byId = new Map<string, AppTrack>();
  for (const t of [...downloadTracks, ...deviceTracks]) byId.set(t.id, t);
  return Array.from(byId.values()).filter(
    t => t.title.toLowerCase().includes(q) || (t.artist ?? '').toLowerCase().includes(q),
  );
}

/** Merges online + local song matches into one list, deduped by id with
 *  local taking precedence (see the Row comment above). */
function buildSongRows(onlineSongs: Song[], localTracks: AppTrack[]): Row[] {
  const localIds = new Set(localTracks.map(t => t.id));
  const filteredOnline = onlineSongs.filter(s => !localIds.has(s.id));
  const onlineRows: Row[] = filteredOnline.map(
    (item, i) => ({kind: 'song', item, songsForQueue: filteredOnline, queueIndex: i}) as Row,
  );
  const localRows: Row[] = localTracks.map(
    (item, i) => ({kind: 'local-song', item, tracksForQueue: localTracks, queueIndex: i}) as Row,
  );
  return [...onlineRows, ...localRows];
}

/** Grey = local/offline, green = inotune/online — applied only to songs,
 *  the one result kind that can genuinely come from either world. */
function SourceDot({source}: {source: 'local' | 'online'}): React.JSX.Element {
  return <View style={[styles.sourceDot, source === 'local' ? styles.sourceDotLocal : styles.sourceDotOnline]} />;
}

export default function SearchScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const {playQueue} = usePlaybackQueue();
  const {viewMode} = useNetworkStatus();
  const isOffline = viewMode === 'offline';
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [loading, setLoading] = useState(false);
  const [globalResult, setGlobalResult] = useState<GlobalSearchResult | null>(null);
  const [songResults, setSongResults] = useState<Song[]>([]);
  const [albumResults, setAlbumResults] = useState<AlbumSearchResult[]>([]);
  const [artistResults, setArtistResults] = useState<ArtistSearchResult[]>([]);
  const [playlistResults, setPlaylistResults] = useState<PlaylistSearchResult[]>([]);
  const [localResults, setLocalResults] = useState<AppTrack[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  const runSearch = async (text: string, activeFilter: FilterKey) => {
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      setGlobalResult(null);
      setSongResults([]);
      setAlbumResults([]);
      setArtistResults([]);
      setPlaylistResults([]);
      setLocalResults([]);
      return;
    }

    // Local matches are synchronous (no network), so they're always
    // available immediately regardless of connectivity.
    setLocalResults(searchLocalTracks(trimmed));

    if (isOffline) {
      // Nothing reachable — clear any stale online results from before
      // connectivity dropped so they don't linger next to local matches.
      setLoading(false);
      setGlobalResult(null);
      setSongResults([]);
      setAlbumResults([]);
      setArtistResults([]);
      setPlaylistResults([]);
      return;
    }

    const requestId = ++requestIdRef.current;
    setLoading(true);
    try {
      if (activeFilter === 'all') {
        const result = await globalSearch(trimmed);
        if (requestId === requestIdRef.current) setGlobalResult(result);
      } else if (activeFilter === 'songs') {
        const result = await searchSongs(trimmed);
        if (requestId === requestIdRef.current) setSongResults(result.results);
      } else if (activeFilter === 'albums') {
        const result = await searchAlbums(trimmed);
        if (requestId === requestIdRef.current) setAlbumResults(result.results);
      } else if (activeFilter === 'artists') {
        const result = await searchArtists(trimmed);
        if (requestId === requestIdRef.current) setArtistResults(result.results);
      } else {
        const result = await searchPlaylists(trimmed);
        if (requestId === requestIdRef.current) setPlaylistResults(result.results);
      }
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  };

  const handleChangeText = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(text, filter), DEBOUNCE_MS);
  };

  const handleFilterChange = (next: FilterKey) => {
    setFilter(next);
    runSearch(query, next);
  };

  const handleSongPress = (songs: Song[], index: number) => {
    playQueue(songsToTracks(songs), index);
  };

  const handleLocalTrackPress = (tracks: AppTrack[], index: number) => {
    playQueue(tracks, index);
  };

  const rows: Row[] = (() => {
    if (filter === 'songs') return buildSongRows(songResults, localResults);
    if (filter === 'albums') return albumResults.map(item => ({kind: 'album', item}) as Row);
    if (filter === 'artists') return artistResults.map(item => ({kind: 'artist', item}) as Row);
    if (filter === 'playlists') return playlistResults.map(item => ({kind: 'playlist', item}) as Row);
    // 'all'
    const onlineSongs = globalResult?.songs.results ?? [];
    const songRows = buildSongRows(onlineSongs, localResults);
    if (!globalResult) return songRows;
    return [
      ...songRows,
      ...globalResult.albums.results.map(item => ({kind: 'album', item}) as Row),
      ...globalResult.artists.results.map(item => ({kind: 'artist', item}) as Row),
      ...globalResult.playlists.results.map(item => ({kind: 'playlist', item}) as Row),
    ];
  })();

  const showOfflineOnlyHint = isOffline && (filter === 'albums' || filter === 'artists' || filter === 'playlists');

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.searchInput}
        placeholder={isOffline ? 'Search downloaded & device songs' : 'Search songs, albums, artists, playlists'}
        placeholderTextColor="#ffffff80"
        value={query}
        onChangeText={handleChangeText}
      />
      <View style={styles.pillsRow}>
        {FILTERS.map(f => (
          <Pressable
            key={f.key}
            style={[styles.pill, filter === f.key && styles.pillActive]}
            onPress={() => handleFilterChange(f.key)}>
            <Text style={[styles.pillText, filter === f.key && styles.pillTextActive]}>{f.label}</Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color="#1db954" style={styles.loading} />
      ) : showOfflineOnlyHint ? (
        <Text style={styles.offlineHint}>
          {FILTERS.find(f => f.key === filter)?.label} need an internet connection — try Songs for what's downloaded
          or on this device.
        </Text>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(row, i) => `${row.kind}-${row.item.id}-${i}`}
          contentContainerStyle={styles.list}
          renderItem={({item: row}) => {
            if (row.kind === 'song') {
              return (
                <Pressable style={styles.resultRow} onPress={() => handleSongPress(row.songsForQueue, row.queueIndex)}>
                  <Image source={{uri: bestImage(row.item.image)}} style={styles.resultImage} />
                  <View style={styles.resultText}>
                    <Text style={styles.resultTitle} numberOfLines={1}>
                      {row.item.name}
                    </Text>
                    <Text style={styles.resultSubtitle} numberOfLines={1}>
                      {row.item.artists?.primary?.map(a => a.name).join(', ')}
                    </Text>
                  </View>
                  <SourceDot source="online" />
                </Pressable>
              );
            }
            if (row.kind === 'local-song') {
              return (
                <Pressable
                  style={styles.resultRow}
                  onPress={() => handleLocalTrackPress(row.tracksForQueue, row.queueIndex)}>
                  {row.item.artworkUrl ? (
                    <Image source={{uri: row.item.artworkUrl}} style={styles.resultImage} />
                  ) : (
                    <View style={[styles.resultImage, styles.resultImageFallback]} />
                  )}
                  <View style={styles.resultText}>
                    <Text style={styles.resultTitle} numberOfLines={1}>
                      {row.item.title}
                    </Text>
                    <Text style={styles.resultSubtitle} numberOfLines={1}>
                      {row.item.artist}
                    </Text>
                  </View>
                  <SourceDot source="local" />
                </Pressable>
              );
            }
            if (row.kind === 'album') {
              return (
                <Pressable
                  style={styles.resultRow}
                  onPress={() => navigation.navigate('AlbumDetail', {id: row.item.id})}>
                  <Image source={{uri: bestImage(row.item.image)}} style={styles.resultImage} />
                  <View style={styles.resultText}>
                    <Text style={styles.resultTitle} numberOfLines={1}>
                      {row.item.title}
                    </Text>
                    <Text style={styles.resultSubtitle} numberOfLines={1}>
                      {row.item.artist}
                    </Text>
                  </View>
                </Pressable>
              );
            }
            if (row.kind === 'artist') {
              return (
                <Pressable
                  style={styles.resultRow}
                  onPress={() => navigation.navigate('ArtistDetail', {id: row.item.id})}>
                  <Image source={{uri: bestImage(row.item.image)}} style={[styles.resultImage, styles.artistImage]} />
                  <View style={styles.resultText}>
                    <Text style={styles.resultTitle} numberOfLines={1}>
                      {row.item.name}
                    </Text>
                  </View>
                </Pressable>
              );
            }
            return (
              <Pressable
                style={styles.resultRow}
                onPress={() => navigation.navigate('PlaylistDetail', {id: row.item.id})}>
                <Image source={{uri: bestImage(row.item.image)}} style={styles.resultImage} />
                <View style={styles.resultText}>
                  <Text style={styles.resultTitle} numberOfLines={1}>
                    {row.item.name}
                  </Text>
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            query.trim().length > 0 ? (
              <Text style={styles.emptyText}>
                {isOffline ? "No matches in what's downloaded or on this device." : 'No results.'}
              </Text>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#000', paddingTop: 12},
  searchInput: {
    marginHorizontal: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#fff',
  },
  pillsRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, marginTop: 12},
  pill: {paddingVertical: 6, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1, borderColor: '#ffffff33'},
  pillActive: {backgroundColor: '#1db954', borderColor: '#1db954'},
  pillText: {color: '#ffffffb3', fontSize: 13},
  pillTextActive: {color: '#000', fontWeight: '700'},
  loading: {marginTop: 32},
  offlineHint: {color: '#ffffff80', fontSize: 13, textAlign: 'center', marginTop: 32, paddingHorizontal: 32, lineHeight: 18},
  list: {paddingHorizontal: 16, paddingTop: 12, paddingBottom: 140},
  resultRow: {flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 12},
  resultImage: {width: 48, height: 48, borderRadius: 6, backgroundColor: '#222'},
  resultImageFallback: {backgroundColor: '#1a1a1a'},
  artistImage: {borderRadius: 24},
  resultText: {flex: 1},
  resultTitle: {color: '#fff', fontWeight: '600'},
  resultSubtitle: {color: '#ffffff80', fontSize: 12, marginTop: 2},
  sourceDot: {width: 9, height: 9, borderRadius: 4.5},
  sourceDotLocal: {backgroundColor: '#8a8a8a'},
  sourceDotOnline: {backgroundColor: '#1db954'},
  emptyText: {color: '#ffffff80', textAlign: 'center', marginTop: 32},
});
