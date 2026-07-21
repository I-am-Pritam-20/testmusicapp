import React, {useCallback, useState} from 'react';
import {FlatList, Image, Pressable, StyleSheet, Text, View} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import Icon from '@react-native-vector-icons/material-design-icons';
import {LibraryService, type DownloadedTrack} from '../services/LibraryService';
import {usePlaybackQueue} from '../context/PlaybackQueueContext';
import MusicPlayer from '../native-kit/MusicPlayer';
import {useAppAlert} from '../components/AppAlertProvider';
import {useAppToast} from '../components/AppToastProvider';

export default function DownloadsScreen(): React.JSX.Element {
  const {playQueue} = usePlaybackQueue();
  const {showAlert} = useAppAlert();
  const {showToast} = useAppToast();
  const [downloads, setDownloads] = useState<DownloadedTrack[]>([]);

  const refresh = useCallback(() => {
    setDownloads(LibraryService.getDownloads());
  }, []);

  useFocusEffect(refresh);

  const playDownloaded = (index: number) => {
    playQueue(
      downloads.map(d => ({...d, url: d.localPath})),
      index,
    );
  };

  const handleRemove = (track: DownloadedTrack) => {
    showAlert({
      title: 'Remove download',
      message: `Delete "${track.title}" from downloads?`,
      buttons: [
        {label: 'Cancel', style: 'cancel'},
        {
          label: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await MusicPlayer.deleteDownloadedFile(track.localPath);
            LibraryService.removeDownload(track.id);
            refresh();
            showToast({message: 'Download removed', durationMs: 2000});
          },
        },
      ],
    });
  };

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={downloads}
      keyExtractor={t => t.id}
      ListHeaderComponent={<Text style={styles.header}>Downloaded</Text>}
      renderItem={({item, index}) => (
        <Pressable style={styles.row} onPress={() => playDownloaded(index)} onLongPress={() => handleRemove(item)}>
          {item.artworkUrl ? (
            <Image source={{uri: item.artworkUrl}} style={styles.image} />
          ) : (
            <View style={[styles.image, styles.imagePlaceholder]}>
              <Icon name="download" color="#ffffff80" size={18} />
            </View>
          )}
          <View style={styles.text}>
            <Text style={styles.title} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.artist} numberOfLines={1}>
              {item.artist}
            </Text>
          </View>
        </Pressable>
      )}
      ListEmptyComponent={<Text style={styles.empty}>Downloaded songs will show up here. Long-press to remove.</Text>}
    />
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#000'},
  content: {padding: 16, paddingBottom: 140},
  header: {color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 16},
  row: {flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8},
  image: {width: 48, height: 48, borderRadius: 6, backgroundColor: '#222'},
  imagePlaceholder: {alignItems: 'center', justifyContent: 'center'},
  text: {flex: 1},
  title: {color: '#fff'},
  artist: {color: '#ffffff80', fontSize: 12, marginTop: 2},
  empty: {color: '#ffffff80', textAlign: 'center', marginTop: 20},
});