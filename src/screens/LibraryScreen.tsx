import React, {useCallback, useState} from 'react';
import {Alert, FlatList, Image, Pressable, StyleSheet, Text, TextInput, View} from 'react-native';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import Icon from '@react-native-vector-icons/material-design-icons';
import type {RootStackParamList} from '../navigation/RootNavigator';
import {LibraryService, type DownloadedTrack, type LikedArtist, type LocalPlaylist} from '../services/LibraryService';
import {usePlaybackQueue} from '../context/PlaybackQueueContext';
import MusicPlayer, {type DeviceAudioFile} from '../native-kit/MusicPlayer';
import {ensureAudioPermission} from '../native-kit/permissions';
import type {AppTrack} from '../services/trackMapper';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type LibrarySection = 'likedSongs' | 'followedArtists' | 'downloads' | 'deviceFiles';

export default function LibraryScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const {playQueue} = usePlaybackQueue();
  const [playlists, setPlaylists] = useState<LocalPlaylist[]>([]);
  const [likedSongs, setLikedSongs] = useState<AppTrack[]>([]);
  const [followedArtists, setFollowedArtists] = useState<LikedArtist[]>([]);
  const [downloads, setDownloads] = useState<DownloadedTrack[]>([]);
  const [deviceFiles, setDeviceFiles] = useState<DeviceAudioFile[]>([]);
  const [expandedSection, setExpandedSection] = useState<LibrarySection | null>(null);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [creatingPlaylist, setCreatingPlaylist] = useState(false);
  const [scanningDevice, setScanningDevice] = useState(false);

  const refresh = useCallback(() => {
    setPlaylists(LibraryService.getPlaylists());
    setLikedSongs(LibraryService.getLikedSongs());
    setFollowedArtists(LibraryService.getLikedArtists());
    setDownloads(LibraryService.getDownloads());
  }, []);

  useFocusEffect(refresh);

  const handleCreatePlaylist = () => {
    if (newPlaylistName.trim().length === 0) return;
    LibraryService.createPlaylist(newPlaylistName.trim());
    setNewPlaylistName('');
    setCreatingPlaylist(false);
    refresh();
  };

  const handleRemovePlaylist = (playlist: LocalPlaylist) => {
    Alert.alert('Remove playlist', `Remove "${playlist.name}"? This can't be undone.`, [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          LibraryService.removePlaylist(playlist.id);
          refresh();
        },
      },
    ]);
  };

  const handleScanDeviceFiles = async () => {
    setScanningDevice(true);
    try {
      const granted = await ensureAudioPermission();
      if (!granted) {
        Alert.alert('Permission needed', 'Allow music library access in system settings to see local songs.');
        return;
      }
      const files = await MusicPlayer.scanDeviceAudio();
      setDeviceFiles(files);
      setExpandedSection('deviceFiles');
    } catch (e) {
      Alert.alert('Scan failed', (e as Error).message);
    } finally {
      setScanningDevice(false);
    }
  };

  const playLocalTrack = (files: DeviceAudioFile[], index: number) => {
    const tracks: AppTrack[] = files.map(f => ({
      id: f.id,
      url: f.url,
      sourceType: 'local',
      title: f.title,
      artist: f.artist,
      durationMs: f.durationMs,
    }));
    playQueue(tracks, index);
  };

  const playDownloaded = (index: number) => {
    // Play from the local file path, not the original remote URL.
    playQueue(
      downloads.map(d => ({...d, url: d.localPath})),
      index,
    );
  };

  const toggle = (section: LibrarySection) => setExpandedSection(prev => (prev === section ? null : section));

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={playlists}
      keyExtractor={p => p.id}
      ListHeaderComponent={
        <View>
          <View style={styles.headerRow}>
            <Text style={styles.header}>Your Library</Text>
            <Pressable onPress={() => setCreatingPlaylist(v => !v)}>
              <Icon name="plus" color="#fff" size={26} />
            </Pressable>
          </View>

          {creatingPlaylist && (
            <View style={styles.newPlaylistRow}>
              <TextInput
                style={styles.newPlaylistInput}
                placeholder="Playlist name"
                placeholderTextColor="#ffffff80"
                value={newPlaylistName}
                onChangeText={setNewPlaylistName}
                autoFocus
              />
              <Pressable onPress={handleCreatePlaylist}>
                <Icon name="check" color="#1db954" size={24} />
              </Pressable>
            </View>
          )}

          <Pressable style={styles.pinnedRow} onPress={() => toggle('likedSongs')}>
            <View style={[styles.pinnedIcon, {backgroundColor: '#5f2c82'}]}>
              <Icon name="heart" color="#fff" size={22} />
            </View>
            <Text style={styles.pinnedLabel}>Liked Songs · {likedSongs.length}</Text>
            <Icon name={expandedSection === 'likedSongs' ? 'chevron-up' : 'chevron-down'} color="#ffffff80" size={20} />
          </Pressable>
          {expandedSection === 'likedSongs' &&
            likedSongs.map((track, index) => (
              <Pressable key={track.id} style={styles.subRow} onPress={() => playQueue(likedSongs, index)}>
                <Text style={styles.subRowTitle} numberOfLines={1}>
                  {track.title}
                </Text>
                <Text style={styles.subRowSubtitle} numberOfLines={1}>
                  {track.artist}
                </Text>
              </Pressable>
            ))}

          <Pressable style={styles.pinnedRow} onPress={() => toggle('followedArtists')}>
            <View style={[styles.pinnedIcon, {backgroundColor: '#1d3672'}]}>
              <Icon name="account-music" color="#fff" size={22} />
            </View>
            <Text style={styles.pinnedLabel}>Followed Artists · {followedArtists.length}</Text>
            <Icon
              name={expandedSection === 'followedArtists' ? 'chevron-up' : 'chevron-down'}
              color="#ffffff80"
              size={20}
            />
          </Pressable>
          {expandedSection === 'followedArtists' &&
            followedArtists.map(artist => (
              <Pressable
                key={artist.id}
                style={styles.subRow}
                onPress={() => navigation.navigate('ArtistDetail', {id: artist.id})}>
                <Text style={styles.subRowTitle}>{artist.name}</Text>
              </Pressable>
            ))}

          <Pressable style={styles.pinnedRow} onPress={() => toggle('downloads')}>
            <View style={[styles.pinnedIcon, {backgroundColor: '#2a5c3f'}]}>
              <Icon name="download" color="#fff" size={22} />
            </View>
            <Text style={styles.pinnedLabel}>Downloaded · {downloads.length}</Text>
            <Icon name={expandedSection === 'downloads' ? 'chevron-up' : 'chevron-down'} color="#ffffff80" size={20} />
          </Pressable>
          {expandedSection === 'downloads' &&
            downloads.map((track, index) => (
              <Pressable key={track.id} style={styles.subRow} onPress={() => playDownloaded(index)}>
                <Text style={styles.subRowTitle} numberOfLines={1}>
                  {track.title}
                </Text>
                <Text style={styles.subRowSubtitle} numberOfLines={1}>
                  {track.artist}
                </Text>
              </Pressable>
            ))}

          <Pressable style={styles.pinnedRow} onPress={handleScanDeviceFiles}>
            <View style={[styles.pinnedIcon, {backgroundColor: '#5c4a2a'}]}>
              <Icon name="folder-music" color="#fff" size={22} />
            </View>
            <Text style={styles.pinnedLabel}>{scanningDevice ? 'Scanning…' : `On This Device · ${deviceFiles.length}`}</Text>
            <Icon name={expandedSection === 'deviceFiles' ? 'chevron-up' : 'chevron-down'} color="#ffffff80" size={20} />
          </Pressable>
          {expandedSection === 'deviceFiles' &&
            deviceFiles.map((file, index) => (
              <Pressable key={file.id} style={styles.subRow} onPress={() => playLocalTrack(deviceFiles, index)}>
                <Text style={styles.subRowTitle} numberOfLines={1}>
                  {file.title}
                </Text>
                <Text style={styles.subRowSubtitle} numberOfLines={1}>
                  {file.artist}
                </Text>
              </Pressable>
            ))}

          <Text style={styles.playlistsHeading}>Playlists</Text>
        </View>
      }
      renderItem={({item: playlist}) => (
        <Pressable
          style={styles.playlistRow}
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
            <Text style={styles.playlistSubtitle}>{playlist.tracks.length} songs</Text>
          </View>
        </Pressable>
      )}
      ListEmptyComponent={<Text style={styles.emptyPlaylists}>No playlists yet — tap + to create one. Long-press to remove.</Text>}
    />
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#000'},
  content: {paddingHorizontal: 16, paddingTop: 16, paddingBottom: 140},
  headerRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16},
  header: {color: '#fff', fontSize: 24, fontWeight: '700'},
  newPlaylistRow: {flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16},
  newPlaylistInput: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#fff',
  },
  pinnedRow: {flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10},
  pinnedIcon: {width: 44, height: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center'},
  pinnedLabel: {flex: 1, color: '#fff', fontWeight: '600'},
  subRow: {paddingVertical: 8, paddingLeft: 56},
  subRowTitle: {color: '#fff'},
  subRowSubtitle: {color: '#ffffff80', fontSize: 12, marginTop: 2},
  playlistsHeading: {color: '#fff', fontSize: 16, fontWeight: '700', marginTop: 16, marginBottom: 8},
  playlistRow: {flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8},
  playlistImage: {width: 48, height: 48, borderRadius: 6, backgroundColor: '#222'},
  playlistImagePlaceholder: {alignItems: 'center', justifyContent: 'center'},
  playlistText: {flex: 1},
  playlistTitle: {color: '#fff', fontWeight: '600'},
  playlistSubtitle: {color: '#ffffff80', fontSize: 12, marginTop: 2},
  emptyPlaylists: {color: '#ffffff80', textAlign: 'center', marginTop: 20},
});
