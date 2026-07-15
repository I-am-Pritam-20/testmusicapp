import React, {useRef, useState} from 'react';
import {ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, TextInput, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../navigation/RootNavigator';
import {globalSearch, searchAlbums, searchArtists, searchPlaylists, searchSongs} from '../services/musicApi';
import {songsToTracks} from '../services/trackMapper';
import {usePlaybackQueue} from '../context/PlaybackQueueContext';
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

type Row =
  | {kind: 'song'; item: Song; songsForQueue: Song[]; queueIndex: number}
  | {kind: 'album'; item: AlbumSearchResult}
  | {kind: 'artist'; item: ArtistSearchResult}
  | {kind: 'playlist'; item: PlaylistSearchResult};

export default function SearchScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const {playQueue} = usePlaybackQueue();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [loading, setLoading] = useState(false);
  const [globalResult, setGlobalResult] = useState<GlobalSearchResult | null>(null);
  const [songResults, setSongResults] = useState<Song[]>([]);
  const [albumResults, setAlbumResults] = useState<AlbumSearchResult[]>([]);
  const [artistResults, setArtistResults] = useState<ArtistSearchResult[]>([]);
  const [playlistResults, setPlaylistResults] = useState<PlaylistSearchResult[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  const runSearch = async (text: string, activeFilter: FilterKey) => {
    if (text.trim().length === 0) {
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
        const result = await globalSearch(text);
        if (requestId === requestIdRef.current) setGlobalResult(result);
      } else if (activeFilter === 'songs') {
        const result = await searchSongs(text);
        if (requestId === requestIdRef.current) setSongResults(result.results);
      } else if (activeFilter === 'albums') {
        const result = await searchAlbums(text);
        if (requestId === requestIdRef.current) setAlbumResults(result.results);
      } else if (activeFilter === 'artists') {
        const result = await searchArtists(text);
        if (requestId === requestIdRef.current) setArtistResults(result.results);
      } else {
        const result = await searchPlaylists(text);
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

  const rows: Row[] = (() => {
    if (filter === 'songs') {
      return songResults.map((item, i) => ({kind: 'song', item, songsForQueue: songResults, queueIndex: i}) as Row);
    }
    if (filter === 'albums') return albumResults.map(item => ({kind: 'album', item}) as Row);
    if (filter === 'artists') return artistResults.map(item => ({kind: 'artist', item}) as Row);
    if (filter === 'playlists') return playlistResults.map(item => ({kind: 'playlist', item}) as Row);
    if (!globalResult) return [];
    return [
      ...globalResult.songs.results.map(
        (item, i) => ({kind: 'song', item, songsForQueue: globalResult.songs.results, queueIndex: i}) as Row,
      ),
      ...globalResult.albums.results.map(item => ({kind: 'album', item}) as Row),
      ...globalResult.artists.results.map(item => ({kind: 'artist', item}) as Row),
      ...globalResult.playlists.results.map(item => ({kind: 'playlist', item}) as Row),
    ];
  })();

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.searchInput}
        placeholder="Search songs, albums, artists, playlists"
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
  list: {paddingHorizontal: 16, paddingTop: 12, paddingBottom: 140},
  resultRow: {flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 12},
  resultImage: {width: 48, height: 48, borderRadius: 6, backgroundColor: '#222'},
  artistImage: {borderRadius: 24},
  resultText: {flex: 1},
  resultTitle: {color: '#fff', fontWeight: '600'},
  resultSubtitle: {color: '#ffffff80', fontSize: 12, marginTop: 2},
});
