import React from 'react';
import {Image, Pressable, StyleSheet, Text, View} from 'react-native';

export interface MiniPlayerBarProps {
  title: string;
  artist: string;
  artworkUrl?: string;
  isPlaying: boolean;
  onPress: () => void;
  onPlayPause: () => void;
  onNext: () => void;
  /** Extra space reserved below the 64dp content row, so the bar floats
   *  above the gesture-nav / home-indicator area instead of sitting partly
   *  under it — pass safe-area bottom inset from the screen. */
  insetBottom?: number;
}

export default function MiniPlayerBar({
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
    <Pressable style={[styles.container, {height: 64 + insetBottom}]} onPress={onPress}>
      <View style={styles.row}>
        {artworkUrl ? (
          <Image source={{uri: artworkUrl}} style={styles.artwork} />
        ) : (
          <View style={[styles.artwork, styles.artworkPlaceholder]} />
        )}
        <View style={styles.textBlock}>
          <Text style={styles.title} numberOfLines={1}>
            {title || 'Nothing playing'}
          </Text>
          <Text style={styles.artist} numberOfLines={1}>
            {artist}
          </Text>
        </View>
        <Pressable hitSlop={12} onPress={onPlayPause} style={styles.button}>
          <Text style={styles.buttonText}>{isPlaying ? '⏸' : '▶'}</Text>
        </Pressable>
        <Pressable hitSlop={12} onPress={onNext} style={styles.button}>
          <Text style={styles.buttonText}>⏭</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {backgroundColor: '#161616'},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 64,
    paddingHorizontal: 12,
  },
  artwork: {width: 44, height: 44, borderRadius: 8},
  artworkPlaceholder: {backgroundColor: '#333'},
  textBlock: {flex: 1, marginLeft: 10},
  title: {color: '#fff', fontWeight: '600'},
  artist: {color: '#ffffffb3', marginTop: 2},
  button: {paddingHorizontal: 8},
  buttonText: {color: '#fff', fontSize: 20},
});