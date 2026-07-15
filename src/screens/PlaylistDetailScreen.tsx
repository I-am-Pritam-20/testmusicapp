import React, {useCallback, useState} from 'react';
import {ActivityIndicator, Alert, FlatList, Image, Pressable, StyleSheet, Text, View} from 'react-native';
import {useFocusEffect, useRoute, type RouteProp} from '@react-navigation/native';
import type {RootStackParamList} from '../navigation/RootNavigator';
import {getPlaylist} from '../services/musicApi';
import {songsToTracks, type AppTrack} from '../services/trackMapper';
import {usePlaybackQueue} from '../context/PlaybackQueueContext';
import {LibraryService} from '../services/LibraryService';
import type {ImageLink} from '../services/types';

type Route = RouteProp<RootStackParamList, 'PlaylistDetail'>;

function bestImage(images: ImageLink[] | undefined): string | undefined {
  return images && images.length > 0 ? images[images.length - 1].url : undefined;
}

export default function PlaylistDetailScreen(): React.JSX.Element {
  const {params} = useRoute<Route>();
  const {playQueue} = usePlaybackQueue();
  const [tracks, setTracks] = useState<AppTrack[]>([]);
  const [title, setTitle] = useState('');
  const [artwork, setArtwork] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);

  const isLocal = params.localPlaylistId != null;

  const loadLocal = useCallback(() => {
    if (!params.localPlaylistId) return;
    const local = LibraryService.getPlaylist(params.localPlaylistId);
    setTitle(local?.name ?? 'Playlist');
    setTracks(local?.tracks ?? []);
    setArtwork(local?.tracks[0]?.artworkUrl);
    setLoading(false);
  }, [params.localPlaylistId]);

  // Local playlists can change (remove track) while this screen is open —
  // re-read on focus so it reflects the latest state.
  useFocusEffect(
    useCallback(() => {
      if (isLocal) loadLocal();
    }, [isLocal, loadLocal]),
  );

  React.useEffect(() => {
    if (isLocal) return;
    getPlaylist({id: params.id, link: params.link})
      .then(playlist => {
        setTitle(playlist.name);
        setArtwork(bestImage(playlist.image));
        setTracks(songsToTracks(playlist.songs));
      })
      .finally(() => setLoading(false));
  }, [isLocal, params.id, params.link]);

  const handleRemoveTrack = (track: AppTrack) => {
    if (!params.localPlaylistId) return;
    Alert.alert('Remove song', `Remove "${track.title}" from this playlist?`, [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          LibraryService.removeTrackFromPlaylist(params.localPlaylistId!, track.id);
          loadLocal();
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#1db954" />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={tracks}
      keyExtractor={t => t.id}
      ListHeaderComponent={
        <View style={styles.headerBlock}>
          {artwork ? (
            <Image source={{uri: artwork}} style={styles.artwork} />
          ) : (
            <View style={[styles.artwork, styles.artworkPlaceholder]} />
          )}
          <Text style={styles.title}>{title}</Text>
          {tracks.length > 0 && (
            <Pressable style={styles.playAllButton} onPress={() => playQueue(tracks, 0)}>
              <Text style={styles.playAllText}>Play</Text>
            </Pressable>
          )}
        </View>
      }
      renderItem={({item, index}) => (
        <Pressable
          style={styles.songRow}
          onPress={() => playQueue(tracks, index)}
          onLongPress={isLocal ? () => handleRemoveTrack(item) : undefined}>
          <Text style={styles.songTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.songSubtitle} numberOfLines={1}>
            {item.artist}
          </Text>
        </Pressable>
      )}
      ListEmptyComponent={
        <Text style={styles.emptyText}>
          {isLocal ? 'No songs yet — add some from a song\u2019s "Add to Playlist" option.' : 'No songs'}
        </Text>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#000'},
  centered: {flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center'},
  emptyText: {color: '#ffffff80', textAlign: 'center', marginTop: 20, paddingHorizontal: 24},
  content: {padding: 16, paddingBottom: 140},
  headerBlock: {alignItems: 'center', marginBottom: 20},
  artwork: {width: 200, height: 200, borderRadius: 8, backgroundColor: '#222'},
  artworkPlaceholder: {},
  title: {color: '#fff', fontSize: 20, fontWeight: '700', marginTop: 14, textAlign: 'center'},
  playAllButton: {marginTop: 16, backgroundColor: '#1db954', borderRadius: 20, paddingVertical: 10, paddingHorizontal: 32},
  playAllText: {color: '#000', fontWeight: '700'},
  songRow: {paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#ffffff14'},
  songTitle: {color: '#fff'},
  songSubtitle: {color: '#ffffff80', fontSize: 12, marginTop: 2},
});
