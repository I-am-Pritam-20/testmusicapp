import React, {useCallback, useState} from 'react';
import {FlatList, Image, Pressable, StyleSheet, Text, View} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import Icon from '@react-native-vector-icons/material-design-icons';
import {DeviceLibraryService, type TrackedFolder} from '../services/DeviceLibraryService';
import type {DeviceAudioFile} from '../native-kit/DeviceLibrary';
import {usePlaybackQueue} from '../context/PlaybackQueueContext';
import {useAppAlert} from '../components/AppAlertProvider';
import {useAppToast} from '../components/AppToastProvider';
import {ensureAudioPermission} from '../native-kit/permissions';
import type {AppTrack} from '../services/trackMapper';

export default function DeviceSongsScreen(): React.JSX.Element {
  const {playQueue} = usePlaybackQueue();
  const {showAlert} = useAppAlert();
  const {showToast} = useAppToast();
  const [folders, setFolders] = useState<TrackedFolder[]>([]);
  const [files, setFiles] = useState<DeviceAudioFile[]>([]);
  const [scanning, setScanning] = useState(false);

  const refresh = useCallback(() => {
    setFolders(DeviceLibraryService.getFolders());
    setFiles(DeviceLibraryService.getFiles());
  }, []);

  useFocusEffect(refresh);

  const handleAddFolder = async () => {
    const granted = await ensureAudioPermission();
    if (!granted) {
      showAlert({
        title: 'Permission needed',
        message: 'Allow music library access in system settings to read local songs.',
        buttons: [{label: 'OK', style: 'default'}],
      });
      return;
    }
    const folder = await DeviceLibraryService.pickAndAddFolder();
    if (folder) refresh();
  };

  const handleScan = async () => {
    setScanning(true);
    try {
      const merged = await DeviceLibraryService.scanAllFolders();
      setFiles(merged);
      showToast({message: 'Scan complete', durationMs: 2000});
    } finally {
      setScanning(false);
    }
  };

  const handleRemoveFolder = (folder: TrackedFolder) => {
    showAlert({
      title: 'Remove folder',
      message: `Remove "${folder.name}"? Songs found in it will be removed from your library and any offline playlists.`,
      buttons: [
        {label: 'Cancel', style: 'cancel'},
        {
          label: 'Remove',
          style: 'destructive',
          onPress: () => {
            DeviceLibraryService.removeFolder(folder.uri);
            refresh();
          },
        },
      ],
    });
  };

  const playFile = (index: number) => {
    const tracks: AppTrack[] = files.map(f => DeviceLibraryService.toAppTrack(f));
    playQueue(tracks, index);
  };

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={files}
      keyExtractor={f => f.id}
      ListHeaderComponent={
        <View>
          <Text style={styles.header}>On This Device</Text>
          <Text style={styles.hint}>Pick one or more folders to scan for songs — nothing is scanned automatically.</Text>

          {folders.map(folder => (
            <View key={folder.uri} style={styles.folderRow}>
              <Icon name="folder-music" color="#ffffffb3" size={20} />
              <Text style={styles.folderName} numberOfLines={1}>
                {folder.name}
              </Text>
              <Pressable hitSlop={12} onPress={() => handleRemoveFolder(folder)}>
                <Icon name="close" color="#ffffff80" size={18} />
              </Pressable>
            </View>
          ))}

          <View style={styles.actionsRow}>
            <Pressable style={styles.addFolderBtn} onPress={handleAddFolder}>
              <Icon name="folder-plus" color="#fff" size={18} />
              <Text style={styles.addFolderText}>Add Folder</Text>
            </Pressable>
            <Pressable
              style={[styles.scanBtn, folders.length === 0 && styles.scanBtnDisabled]}
              disabled={folders.length === 0 || scanning}
              onPress={handleScan}>
              <Text style={styles.scanText}>{scanning ? 'Scanning…' : 'Scan'}</Text>
            </Pressable>
          </View>

          <Text style={styles.songsHeading}>Songs · {files.length}</Text>
        </View>
      }
      renderItem={({item, index}) => (
        <Pressable style={styles.songRow} onPress={() => playFile(index)}>
          {item.thumbnailUri ? (
            <Image source={{uri: item.thumbnailUri}} style={styles.songThumb} />
          ) : (
            <View style={[styles.songThumb, styles.songThumbPlaceholder]}>
              <Icon name="music-note" color="#ffffff80" size={18} />
            </View>
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
      ListEmptyComponent={<Text style={styles.empty}>No songs scanned yet.</Text>}
    />
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#000'},
  content: {padding: 16, paddingBottom: 140},
  header: {color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 6},
  hint: {color: '#ffffff80', fontSize: 12, marginBottom: 16},
  folderRow: {flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8},
  folderName: {flex: 1, color: '#fff'},
  actionsRow: {flexDirection: 'row', gap: 12, marginTop: 12, marginBottom: 20},
  addFolderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#ffffff4d',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  addFolderText: {color: '#fff', fontWeight: '600'},
  scanBtn: {backgroundColor: '#1db954', borderRadius: 20, paddingVertical: 8, paddingHorizontal: 24, justifyContent: 'center'},
  scanBtnDisabled: {opacity: 0.4},
  scanText: {color: '#000', fontWeight: '700'},
  songsHeading: {color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 8},
  songRow: {flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8},
  songThumb: {width: 44, height: 44, borderRadius: 6, backgroundColor: '#222'},
  songThumbPlaceholder: {alignItems: 'center', justifyContent: 'center'},
  songText: {flex: 1},
  songTitle: {color: '#fff'},
  songArtist: {color: '#ffffff80', fontSize: 12, marginTop: 2},
  empty: {color: '#ffffff80', textAlign: 'center', marginTop: 20},
});