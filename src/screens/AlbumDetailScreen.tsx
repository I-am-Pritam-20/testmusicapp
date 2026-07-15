import React, {useEffect, useState} from 'react';
import {ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View} from 'react-native';
import {useRoute, type RouteProp} from '@react-navigation/native';
import type {RootStackParamList} from '../navigation/RootNavigator';
import {getAlbum} from '../services/musicApi';
import type {Album, ImageLink} from '../services/types';
import {songsToTracks} from '../services/trackMapper';
import {usePlaybackQueue} from '../context/PlaybackQueueContext';

type Route = RouteProp<RootStackParamList, 'AlbumDetail'>;

function bestImage(images: ImageLink[] | undefined): string | undefined {
  return images && images.length > 0 ? images[images.length - 1].url : undefined;
}

export default function AlbumDetailScreen(): React.JSX.Element {
  const {params} = useRoute<Route>();
  const {playQueue} = usePlaybackQueue();
  const [album, setAlbum] = useState<Album | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAlbum({id: params.id})
      .then(setAlbum)
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#1db954" />
      </View>
    );
  }
  if (!album) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>Album not found</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={album.songs}
      keyExtractor={s => s.id}
      ListHeaderComponent={
        <View style={styles.headerBlock}>
          <Image source={{uri: bestImage(album.image)}} style={styles.artwork} />
          <Text style={styles.title}>{album.name}</Text>
          <Text style={styles.subtitle}>{album.artists?.primary?.map(a => a.name).join(', ')}</Text>
          {album.songs.length > 0 && (
            <Pressable style={styles.playAllButton} onPress={() => playQueue(songsToTracks(album.songs), 0)}>
              <Text style={styles.playAllText}>Play</Text>
            </Pressable>
          )}
        </View>
      }
      renderItem={({item, index}) => (
        <Pressable style={styles.songRow} onPress={() => playQueue(songsToTracks(album.songs), index)}>
          <Text style={styles.songTitle} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.songSubtitle} numberOfLines={1}>
            {item.artists?.primary?.map(a => a.name).join(', ')}
          </Text>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#000'},
  centered: {flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center'},
  emptyText: {color: '#ffffff80'},
  content: {padding: 16, paddingBottom: 140},
  headerBlock: {alignItems: 'center', marginBottom: 20},
  artwork: {width: 200, height: 200, borderRadius: 8, backgroundColor: '#222'},
  title: {color: '#fff', fontSize: 20, fontWeight: '700', marginTop: 14, textAlign: 'center'},
  subtitle: {color: '#ffffffb3', marginTop: 4, textAlign: 'center'},
  playAllButton: {marginTop: 16, backgroundColor: '#1db954', borderRadius: 20, paddingVertical: 10, paddingHorizontal: 32},
  playAllText: {color: '#000', fontWeight: '700'},
  songRow: {paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#ffffff14'},
  songTitle: {color: '#fff'},
  songSubtitle: {color: '#ffffff80', fontSize: 12, marginTop: 2},
});
