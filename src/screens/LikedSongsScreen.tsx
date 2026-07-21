import React, {useCallback, useState} from 'react';
import {FlatList, Image, Pressable, StyleSheet, Text, View} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {LibraryService} from '../services/LibraryService';
import {usePlaybackQueue} from '../context/PlaybackQueueContext';
import type {AppTrack} from '../services/trackMapper';

export default function LikedSongsScreen(): React.JSX.Element {
  const {playQueue} = usePlaybackQueue();
  const [tracks, setTracks] = useState<AppTrack[]>([]);

  useFocusEffect(
    useCallback(() => {
      setTracks(LibraryService.getLikedSongs());
    }, []),
  );

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={tracks}
      keyExtractor={t => t.id}
      ListHeaderComponent={
        <View style={styles.headerBlock}>
          <View style={styles.headerIcon}>
            <Text style={styles.headerIconText}>♥</Text>
          </View>
          <Text style={styles.header}>Liked Songs</Text>
          <Text style={styles.count}>{tracks.length} songs</Text>
        </View>
      }
      renderItem={({item, index}) => (
        <Pressable style={styles.songRow} onPress={() => playQueue(tracks, index)}>
          {item.artworkUrl ? (
            <Image source={{uri: item.artworkUrl}} style={styles.songImage} />
          ) : (
            <View style={[styles.songImage, styles.songImagePlaceholder]} />
          )}
          <View style={styles.songText}>
            <Text style={styles.songTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.songArtist} numberOfLines={1}>
              {item.artist}
            </Text>
          </View>
        </Pressable>
      )}
      ListEmptyComponent={<Text style={styles.empty}>Songs you like will show up here.</Text>}
    />
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#000'},
  content: {padding: 16, paddingBottom: 140},
  headerBlock: {alignItems: 'center', marginBottom: 24},
  headerIcon: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: '#5f2c82',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  headerIconText: {color: '#fff', fontSize: 32},
  header: {color: '#fff', fontSize: 22, fontWeight: '700'},
  count: {color: '#ffffff80', fontSize: 13, marginTop: 4},
  songRow: {flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8},
  songImage: {width: 44, height: 44, borderRadius: 6, backgroundColor: '#222'},
  songImagePlaceholder: {},
  songText: {flex: 1},
  songTitle: {color: '#fff'},
  songArtist: {color: '#ffffff80', fontSize: 12, marginTop: 2},
  empty: {color: '#ffffff80', textAlign: 'center', marginTop: 20},
});