import React, {useCallback, useState} from 'react';
import {FlatList, Image, Pressable, StyleSheet, Text, View} from 'react-native';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../navigation/RootNavigator';
import {LibraryService, type LikedArtist} from '../services/LibraryService';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function FollowedArtistsScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const [artists, setArtists] = useState<LikedArtist[]>([]);

  useFocusEffect(
    useCallback(() => {
      setArtists(LibraryService.getLikedArtists());
    }, []),
  );

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={artists}
      keyExtractor={a => a.id}
      ListHeaderComponent={<Text style={styles.header}>Followed Artists</Text>}
      renderItem={({item}) => (
        <Pressable style={styles.row} onPress={() => navigation.navigate('ArtistDetail', {id: item.id})}>
          {item.imageUrl ? (
            <Image source={{uri: item.imageUrl}} style={styles.image} />
          ) : (
            <View style={[styles.image, styles.imagePlaceholder]} />
          )}
          <Text style={styles.name}>{item.name}</Text>
        </Pressable>
      )}
      ListEmptyComponent={<Text style={styles.empty}>Artists you follow will show up here.</Text>}
    />
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#000'},
  content: {padding: 16, paddingBottom: 140},
  header: {color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 16},
  row: {flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8},
  image: {width: 48, height: 48, borderRadius: 24, backgroundColor: '#222'},
  imagePlaceholder: {},
  name: {color: '#fff', fontWeight: '600'},
  empty: {color: '#ffffff80', textAlign: 'center', marginTop: 20},
});