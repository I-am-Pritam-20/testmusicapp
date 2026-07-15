import React, {useEffect, useState} from 'react';
import {ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View} from 'react-native';
import {useRoute, type RouteProp} from '@react-navigation/native';
import type {RootStackParamList} from '../navigation/RootNavigator';
import {getArtistById} from '../services/musicApi';
import type {Artist, ImageLink} from '../services/types';
import {songsToTracks} from '../services/trackMapper';
import {usePlaybackQueue} from '../context/PlaybackQueueContext';
import {LibraryService} from '../services/LibraryService';

type Route = RouteProp<RootStackParamList, 'ArtistDetail'>;

function bestImage(images: ImageLink[] | undefined): string | undefined {
  return images && images.length > 0 ? images[images.length - 1].url : undefined;
}

export default function ArtistDetailScreen(): React.JSX.Element {
  const {params} = useRoute<Route>();
  const {playQueue} = usePlaybackQueue();
  const [artist, setArtist] = useState<Artist | null>(null);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);

  useEffect(() => {
    getArtistById(params.id)
      .then(a => {
        setArtist(a);
        setFollowing(LibraryService.isArtistFollowed(params.id));
      })
      .finally(() => setLoading(false));
  }, [params.id]);

  const handleToggleFollow = () => {
    if (!artist) return;
    const nowFollowing = LibraryService.toggleFollowedArtist({
      id: artist.id,
      name: artist.name,
      imageUrl: bestImage(artist.image),
    });
    setFollowing(nowFollowing);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#1db954" />
      </View>
    );
  }
  if (!artist) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>Artist not found</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={artist.topSongs}
      keyExtractor={s => s.id}
      ListHeaderComponent={
        <View style={styles.headerBlock}>
          <Image source={{uri: bestImage(artist.image)}} style={styles.artwork} />
          <Text style={styles.title}>{artist.name}</Text>
          <Pressable style={[styles.followButton, following && styles.followButtonActive]} onPress={handleToggleFollow}>
            <Text style={[styles.followText, following && styles.followTextActive]}>
              {following ? 'Following' : 'Follow'}
            </Text>
          </Pressable>
          {artist.topSongs.length > 0 && <Text style={styles.sectionHeading}>Top Songs</Text>}
        </View>
      }
      renderItem={({item, index}) => (
        <Pressable style={styles.songRow} onPress={() => playQueue(songsToTracks(artist.topSongs), index)}>
          <Text style={styles.songTitle} numberOfLines={1}>
            {item.name}
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
  artwork: {width: 160, height: 160, borderRadius: 80, backgroundColor: '#222'},
  title: {color: '#fff', fontSize: 20, fontWeight: '700', marginTop: 14, textAlign: 'center'},
  followButton: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#ffffff4d',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 24,
  },
  followButtonActive: {backgroundColor: '#1db954', borderColor: '#1db954'},
  followText: {color: '#fff', fontWeight: '600'},
  followTextActive: {color: '#000'},
  sectionHeading: {color: '#fff', fontSize: 16, fontWeight: '700', alignSelf: 'flex-start', marginTop: 24},
  songRow: {paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#ffffff14'},
  songTitle: {color: '#fff'},
});
