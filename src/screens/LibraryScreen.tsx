import React, {useCallback, useRef, useState} from 'react';
import {FlatList, Image, Pressable, StyleSheet, Text, View} from 'react-native';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import Icon from '@react-native-vector-icons/material-design-icons';
import type {RootStackParamList} from '../navigation/RootNavigator';
import {LibraryService, type LocalPlaylist} from '../services/LibraryService';
import {useAppAlert} from '../components/AppAlertProvider';
import {useNetworkStatus} from '../components/NetworkStatusProvider';
import CreatePlaylistModal, {type CreatePlaylistModalHandle} from '../components/CreatePlaylistModal';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function LibraryScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const {showAlert} = useAppAlert();
  const {viewMode} = useNetworkStatus();
  const isOffline = viewMode === 'offline';
  const createPlaylistRef = useRef<CreatePlaylistModalHandle>(null);
  const [playlists, setPlaylists] = useState<LocalPlaylist[]>([]);
  const [likedCount, setLikedCount] = useState(0);
  const [followedCount, setFollowedCount] = useState(0);
  const [downloadsCount, setDownloadsCount] = useState(0);

  const refresh = useCallback(() => {
    setPlaylists(LibraryService.getPlaylists());
    setLikedCount(LibraryService.getLikedSongs().length);
    setFollowedCount(LibraryService.getLikedArtists().length);
    setDownloadsCount(LibraryService.getDownloads().length);
  }, []);

  useFocusEffect(refresh);

  const handleRemovePlaylist = (playlist: LocalPlaylist) => {
    showAlert({
      title: 'Remove playlist',
      message: `Remove "${playlist.name}"? This can't be undone.`,
      buttons: [
        {label: 'Cancel', style: 'cancel'},
        {
          label: 'Remove',
          style: 'destructive',
          onPress: () => {
            LibraryService.removePlaylist(playlist.id);
            refresh();
          },
        },
      ],
    });
  };

  return (
    <View style={styles.container}>
      <FlatList
        contentContainerStyle={styles.content}
        data={playlists}
        keyExtractor={p => p.id}
        ListHeaderComponent={
          <View>
            <View style={styles.headerRow}>
              <Text style={styles.header}>Your Library</Text>
              <Pressable onPress={() => createPlaylistRef.current?.open(isOffline ? 'offline' : 'online')}>
                <Icon name="plus" color="#fff" size={26} />
              </Pressable>
            </View>

            <Pressable
              style={[styles.pinnedRow, isOffline && styles.pinnedRowDisabled]}
              disabled={isOffline}
              onPress={() => navigation.navigate('LikedSongs')}>
              <View style={[styles.pinnedIcon, {backgroundColor: '#5f2c82'}]}>
                <Icon name="heart" color="#fff" size={22} />
              </View>
              <Text style={styles.pinnedLabel}>Liked Songs · {likedCount}</Text>
              {isOffline ? (
                <Icon name="wifi-off" color="#ffffff4d" size={18} />
              ) : (
                <Icon name="chevron-right" color="#ffffff80" size={20} />
              )}
            </Pressable>

            <Pressable
              style={[styles.pinnedRow, isOffline && styles.pinnedRowDisabled]}
              disabled={isOffline}
              onPress={() => navigation.navigate('FollowedArtists')}>
              <View style={[styles.pinnedIcon, {backgroundColor: '#1d3672'}]}>
                <Icon name="account-music" color="#fff" size={22} />
              </View>
              <Text style={styles.pinnedLabel}>Followed Artists · {followedCount}</Text>
              {isOffline ? (
                <Icon name="wifi-off" color="#ffffff4d" size={18} />
              ) : (
                <Icon name="chevron-right" color="#ffffff80" size={20} />
              )}
            </Pressable>

            <Pressable style={styles.pinnedRow} onPress={() => navigation.navigate('Downloads')}>
              <View style={[styles.pinnedIcon, {backgroundColor: '#2a5c3f'}]}>
                <Icon name="download" color="#fff" size={22} />
              </View>
              <Text style={styles.pinnedLabel}>Downloaded · {downloadsCount}</Text>
              <Icon name="chevron-right" color="#ffffff80" size={20} />
            </Pressable>

            <Pressable style={styles.pinnedRow} onPress={() => navigation.navigate('DeviceSongs')}>
              <View style={[styles.pinnedIcon, {backgroundColor: '#5c4a2a'}]}>
                <Icon name="folder-music" color="#fff" size={22} />
              </View>
              <Text style={styles.pinnedLabel}>On This Device</Text>
              <Icon name="chevron-right" color="#ffffff80" size={20} />
            </Pressable>

            <Text style={styles.playlistsHeading}>Playlists</Text>
          </View>
        }
        renderItem={({item: playlist}) => {
          const disabled = isOffline && playlist.type === 'online';
          return (
            <Pressable
              style={[styles.playlistRow, disabled && styles.playlistRowDisabled]}
              disabled={disabled}
              onPress={() => navigation.navigate('PlaylistDetail', {localPlaylistId: playlist.id})}
              onLongPress={() => handleRemovePlaylist(playlist)}>
              {playlist.tracks[0]?.artworkUrl ? (
                <Image source={{uri: playlist.tracks[0].artworkUrl}} style={styles.playlistImage} />
              ) : (
                <View style={[styles.playlistImage, styles.playlistImagePlaceholder]}>
                  <Icon name="playlist-music" color="#ffffff80" size={22} />
                </View>
              )}
              <View style={styles.playlistText}>
                <Text style={styles.playlistTitle} numberOfLines={1}>
                  {playlist.name}
                </Text>
                <Text style={styles.playlistSubtitle}>
                  {disabled
                    ? 'Offline — unavailable until back online'
                    : `${playlist.type === 'offline' ? 'Offline' : 'Online'} · ${playlist.tracks.length} songs`}
                </Text>
              </View>
              {disabled && <Icon name="wifi-off" color="#ffffff4d" size={16} />}
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <Text style={styles.emptyPlaylists}>No playlists yet — tap + to create one. Long-press to remove.</Text>
        }
      />

      <CreatePlaylistModal
        ref={createPlaylistRef}
        onCreated={playlistId => {
          refresh();
          navigation.navigate('PlaylistDetail', {localPlaylistId: playlistId});
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#000'},
  content: {paddingHorizontal: 16, paddingTop: 16, paddingBottom: 140},
  headerRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16},
  header: {color: '#fff', fontSize: 24, fontWeight: '700'},
  pinnedRow: {flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10},
  pinnedRowDisabled: {opacity: 0.4},
  pinnedIcon: {width: 44, height: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center'},
  pinnedLabel: {flex: 1, color: '#fff', fontWeight: '600'},
  playlistsHeading: {color: '#fff', fontSize: 16, fontWeight: '700', marginTop: 16, marginBottom: 8},
  playlistRow: {flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8},
  playlistRowDisabled: {opacity: 0.4},
  playlistImage: {width: 48, height: 48, borderRadius: 6, backgroundColor: '#222'},
  playlistImagePlaceholder: {alignItems: 'center', justifyContent: 'center'},
  playlistText: {flex: 1},
  playlistTitle: {color: '#fff', fontWeight: '600'},
  playlistSubtitle: {color: '#ffffff80', fontSize: 12, marginTop: 2},
  emptyPlaylists: {color: '#ffffff80', textAlign: 'center', marginTop: 20},
});