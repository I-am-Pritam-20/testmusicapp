import React, {useCallback, useMemo, useState} from 'react';
import {ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import Icon from '@react-native-vector-icons/material-design-icons';
import {DeviceLibraryService} from '../services/DeviceLibraryService';
import {LibraryService} from '../services/LibraryService';
import {usePlaybackQueue} from '../context/PlaybackQueueContext';
import {useAppAlert} from '../components/AppAlertProvider';
import {useNetworkStatus} from '../components/NetworkStatusProvider';
import {ensureAudioPermission} from '../native-kit/permissions';
import type {AppTrack} from '../services/trackMapper';

/**
 * Shown on the Home tab whenever there's no real internet connectivity
 * (no transport at all, or a transport with no working internet behind
 * it — see NetworkReachabilityModule). Surfaces everything playable
 * without a network: device-scanned files plus previously downloaded
 * songs, deduped by id.
 */
export default function OfflineHomeScreen(): React.JSX.Element {
  const {playQueue} = usePlaybackQueue();
  const {showAlert} = useAppAlert();
  const {recheck, status} = useNetworkStatus();
  const [tracks, setTracks] = useState<AppTrack[]>([]);
  const [folderCount, setFolderCount] = useState(0);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    const deviceTracks = DeviceLibraryService.getFiles().map(f => DeviceLibraryService.toAppTrack(f));
    const downloadTracks: AppTrack[] = LibraryService.getDownloads();
    const byId = new Map<string, AppTrack>();
    for (const t of [...downloadTracks, ...deviceTracks]) byId.set(t.id, t);
    setTracks(Array.from(byId.values()));
    setFolderCount(DeviceLibraryService.getFolders().length);
  }, []);

  useFocusEffect(refresh);

  const hasAnyOfflineSource = useMemo(() => folderCount > 0 || tracks.length > 0, [folderCount, tracks.length]);

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
    if (!folder) return;
    setBusy(true);
    try {
      await DeviceLibraryService.scanAllFolders();
    } finally {
      setBusy(false);
      refresh();
    }
  };

  const playTrack = (index: number) => playQueue(tracks, index);

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={tracks}
      keyExtractor={t => t.id}
      ListHeaderComponent={
        <View>
          <View style={styles.badgeRow}>
            <View style={styles.dot} />
            <Text style={styles.badgeText}>You're offline</Text>
          </View>
          <Text style={styles.header}>Your Music</Text>
          <Text style={styles.hint}>
            {hasAnyOfflineSource
              ? 'Downloaded songs and songs from folders on this device — no connection needed.'
              : "Nothing offline yet. Add a folder from this device so you've got something to play without a connection."}
          </Text>

          <View style={styles.actionsRow}>
            <Pressable style={styles.primaryBtn} onPress={handleAddFolder} disabled={busy}>
              {busy ? (
                <ActivityIndicator color="#04120a" size="small" />
              ) : (
                <>
                  <Icon name="folder-music-outline" color="#04120a" size={18} />
                  <Text style={styles.primaryBtnLabel}>Device Songs</Text>
                </>
              )}
            </Pressable>
            <Pressable style={styles.secondaryBtn} onPress={recheck} disabled={status === 'checking'}>
              {status === 'checking' ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Icon name="wifi" color="#fff" size={16} />
                  <Text style={styles.secondaryBtnLabel}>Try going online</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      }
      renderItem={({item, index}) => (
        <Pressable style={styles.row} onPress={() => playTrack(index)}>
          {item.artworkUrl ? (
            <Image source={{uri: item.artworkUrl}} style={styles.artwork} />
          ) : (
            <View style={[styles.artwork, styles.artworkFallback]}>
              <Icon name="music-note" color="#ffffff66" size={20} />
            </View>
          )}
          <View style={styles.rowText}>
            <Text style={styles.rowTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.rowArtist} numberOfLines={1}>
              {item.artist}
            </Text>
          </View>
          <View style={styles.localDot} />
        </Pressable>
      )}
      ListEmptyComponent={
        hasAnyOfflineSource ? null : (
          <View style={styles.emptyState}>
            <Icon name="cloud-off-outline" color="#ffffff40" size={48} />
          </View>
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#0d0d0d'},
  content: {paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32},
  badgeRow: {flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12},
  dot: {width: 8, height: 8, borderRadius: 4, backgroundColor: '#8a8a8a'},
  badgeText: {color: '#8a8a8a', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6},
  header: {color: '#fff', fontSize: 26, fontWeight: '800', marginBottom: 6},
  hint: {color: '#a0a0a0', fontSize: 13, lineHeight: 18, marginBottom: 16},
  actionsRow: {flexDirection: 'row', gap: 10, marginBottom: 20},
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1db954',
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  primaryBtnLabel: {color: '#04120a', fontSize: 13, fontWeight: '700'},
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#333',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  secondaryBtnLabel: {color: '#fff', fontSize: 13, fontWeight: '600'},
  row: {flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 12},
  artwork: {width: 48, height: 48, borderRadius: 6, backgroundColor: '#1a1a1a'},
  artworkFallback: {alignItems: 'center', justifyContent: 'center'},
  rowText: {flex: 1},
  rowTitle: {color: '#fff', fontSize: 15, fontWeight: '600'},
  rowArtist: {color: '#9a9a9a', fontSize: 13, marginTop: 2},
  localDot: {width: 8, height: 8, borderRadius: 4, backgroundColor: '#8a8a8a'},
  emptyState: {alignItems: 'center', paddingTop: 64},
});
