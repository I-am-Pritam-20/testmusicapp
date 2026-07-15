import React, {useCallback, useEffect, useState} from 'react';
import {ActivityIndicator, FlatList, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../navigation/RootNavigator';
import {getHomeFeed, refreshHomeFeed, type HomeSection} from '../services/homeFeed';
import {songsToTracks} from '../services/trackMapper';
import {usePlaybackQueue} from '../context/PlaybackQueueContext';
import type {AlbumSearchResult, ArtistSearchResult, ImageLink, PlaylistSearchResult, Song} from '../services/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function bestImage(images: ImageLink[] | undefined): string | undefined {
  return images && images.length > 0 ? images[images.length - 1].url : undefined;
}

export default function HomeScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const {recentTrackIds, playQueue} = usePlaybackQueue();
  const [sections, setSections] = useState<HomeSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const feed = await getHomeFeed(recentTrackIds);
      setSections(feed.sections);
    } finally {
      setLoading(false);
    }
    // Intentionally only on mount — recentTrackIds updating shouldn't
    // re-trigger a full reload, only the next natural refresh should pick
    // up fresh recommendations.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const feed = await refreshHomeFeed(recentTrackIds);
      setSections(feed.sections);
    } finally {
      setRefreshing(false);
    }
  };

  const handleSongPress = (songs: Song[], index: number) => {
    playQueue(songsToTracks(songs), index);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#1db954" size="large" />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={sections}
      keyExtractor={s => s.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1db954" />}
      ListHeaderComponent={<Text style={styles.header}>Good day</Text>}
      renderItem={({item: section}) => (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            {section.kind === 'songs' &&
              (section.items as Song[]).map((song, index) => (
                <Pressable
                  key={song.id}
                  style={styles.card}
                  onPress={() => handleSongPress(section.items as Song[], index)}>
                  <Image source={{uri: bestImage(song.image)}} style={styles.cardImage} />
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {song.name}
                  </Text>
                  <Text style={styles.cardSubtitle} numberOfLines={1}>
                    {song.artists?.primary?.map(a => a.name).join(', ')}
                  </Text>
                </Pressable>
              ))}
            {section.kind === 'albums' &&
              (section.items as AlbumSearchResult[]).map(album => (
                <Pressable
                  key={album.id}
                  style={styles.card}
                  onPress={() => navigation.navigate('AlbumDetail', {id: album.id})}>
                  <Image source={{uri: bestImage(album.image)}} style={styles.cardImage} />
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {album.title}
                  </Text>
                  <Text style={styles.cardSubtitle} numberOfLines={1}>
                    {album.artist}
                  </Text>
                </Pressable>
              ))}
            {section.kind === 'playlists' &&
              (section.items as PlaylistSearchResult[]).map(playlist => (
                <Pressable
                  key={playlist.id}
                  style={styles.card}
                  onPress={() => navigation.navigate('PlaylistDetail', {id: playlist.id})}>
                  <Image source={{uri: bestImage(playlist.image)}} style={styles.cardImage} />
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {playlist.name}
                  </Text>
                </Pressable>
              ))}
            {section.kind === 'artists' &&
              (section.items as ArtistSearchResult[]).map(artist => (
                <Pressable
                  key={artist.id}
                  style={styles.card}
                  onPress={() => navigation.navigate('ArtistDetail', {id: artist.id})}>
                  <Image source={{uri: bestImage(artist.image)}} style={[styles.cardImage, styles.artistImage]} />
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {artist.name}
                  </Text>
                </Pressable>
              ))}
          </ScrollView>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#000'},
  centered: {flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center'},
  content: {paddingBottom: 140},
  header: {color: '#fff', fontSize: 24, fontWeight: '700', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8},
  section: {marginTop: 20},
  sectionTitle: {color: '#fff', fontSize: 18, fontWeight: '700', paddingHorizontal: 16, marginBottom: 10},
  row: {paddingHorizontal: 16, gap: 12},
  card: {width: 130},
  cardImage: {width: 130, height: 130, borderRadius: 8, backgroundColor: '#222'},
  artistImage: {borderRadius: 65},
  cardTitle: {color: '#fff', marginTop: 6, fontSize: 13, fontWeight: '600'},
  cardSubtitle: {color: '#ffffff80', fontSize: 12, marginTop: 2},
});
