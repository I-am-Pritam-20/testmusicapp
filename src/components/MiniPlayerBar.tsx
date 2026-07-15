import React from 'react';
import {Image, Pressable, StyleSheet, Text, View} from 'react-native';
import Icon from '@react-native-vector-icons/material-design-icons';

export interface MiniPlayerBarProps {
  bgColor?: string;
  title: string;
  artist: string;
  artworkUrl?: string;
  isPlaying: boolean;
  onPress: () => void;
  onPlayPause: () => void;
  onNext: () => void;
  /** Safe-area bottom inset — the bar floats 10dp above this, so it clears
   *  the gesture-nav / home-indicator area instead of sitting under it. */
  insetBottom?: number;
}

export default function MiniPlayerBar({
  bgColor,
  title,
  artist,
  artworkUrl,
  isPlaying,
  onPress,
  onPlayPause,
  onNext,
  insetBottom = 0,
}: MiniPlayerBarProps): React.JSX.Element {
  return (
    <Pressable
      style={[styles.container, {bottom: 10 + insetBottom, backgroundColor: bgColor}]}
      onPress={onPress}>
      <View style={styles.row}>
        {artworkUrl ? (
          <Image source={{uri: artworkUrl}} style={styles.artwork} />
        ) : (
          <View style={[styles.artwork, styles.artworkPlaceholder]} />
        )}
        <View style={styles.textBlock}>
          <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
            {title || 'Nothing playing'}
          </Text>
          <Text style={styles.artist} numberOfLines={1}>
            {artist}
          </Text>
        </View>
        <Pressable hitSlop={12} onPress={onPlayPause} style={styles.button}>
          <Icon name={isPlaying ? 'pause' : 'play'} color={'#fff'} size={32} />
        </Pressable>
        <Pressable hitSlop={12} onPress={onNext} style={styles.button}>
          <Icon name="skip-next" color={'#fff'} size={28} />
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    marginHorizontal: 10,
    borderRadius: 20,
    height: 64,
    zIndex: 5,
    elevation: 5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 64,
    paddingHorizontal: 10,
  },
  artwork: {width: 44, height: 44, borderRadius: 10},
  artworkPlaceholder: {backgroundColor: '#333'},
  textBlock: {marginLeft: 10, width: '55%'},
  title: {color: '#fff', fontWeight: '600'},
  artist: {color: '#ffffffb3', marginTop: 2},
  button: {paddingHorizontal: 10},
});
