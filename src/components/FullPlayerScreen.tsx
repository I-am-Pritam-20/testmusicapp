import React from 'react';
import {Image, Pressable, StyleSheet, Text, View} from 'react-native';
import SeekBar from './SeekBar';

export interface FullPlayerScreenProps {
  title: string;
  artist: string;
  artworkUrl?: string;
  isPlaying: boolean;
  positionMs: number;
  durationMs: number;
  isShuffleEnabled: boolean;
  repeatMode: 'off' | 'one' | 'all';
  onCollapse: () => void;
  onPlayPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onSeek: (positionMs: number) => void;
  onToggleShuffle: () => void;
  onCycleRepeat: () => void;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export default function FullPlayerScreen(props: FullPlayerScreenProps): React.JSX.Element {
  const {
    title,
    artist,
    artworkUrl,
    isPlaying,
    positionMs,
    durationMs,
    isShuffleEnabled,
    repeatMode,
    onCollapse,
    onPlayPause,
    onNext,
    onPrevious,
    onSeek,
    onToggleShuffle,
    onCycleRepeat,
  } = props;

  return (
    <View style={styles.container}>
      {/* Tapping/dragging this handle collapses the sheet; the drag itself
          is handled natively by NativeBottomSheet — this Pressable only
          covers the "tap to collapse" case. */}
      <Pressable style={styles.handleArea} onPress={onCollapse}>
        <View style={styles.handle} />
      </Pressable>

      <View style={styles.artworkWrap}>
        {artworkUrl ? (
          <Image source={{uri: artworkUrl}} style={styles.artwork} />
        ) : (
          <View style={[styles.artwork, styles.artworkPlaceholder]} />
        )}
      </View>

      <Text style={styles.title} numberOfLines={1}>
        {title || 'Nothing playing'}
      </Text>
      <Text style={styles.artist} numberOfLines={1}>
        {artist}
      </Text>

      <SeekBar positionMs={positionMs} durationMs={durationMs} onSeek={onSeek} />
      <View style={styles.timeRow}>
        <Text style={styles.timeText}>{formatTime(positionMs)}</Text>
        <Text style={styles.timeText}>{formatTime(durationMs)}</Text>
      </View>

      <View style={styles.transportRow}>
        <Pressable onPress={onToggleShuffle} hitSlop={12}>
          <Text style={[styles.icon, isShuffleEnabled && styles.iconActive]}>🔀</Text>
        </Pressable>
        <Pressable onPress={onPrevious} hitSlop={12}>
          <Text style={styles.iconLarge}>⏮</Text>
        </Pressable>
        <Pressable onPress={onPlayPause} hitSlop={12} style={styles.playButton}>
          <Text style={styles.playIcon}>{isPlaying ? '⏸' : '▶'}</Text>
        </Pressable>
        <Pressable onPress={onNext} hitSlop={12}>
          <Text style={styles.iconLarge}>⏭</Text>
        </Pressable>
        <Pressable onPress={onCycleRepeat} hitSlop={12}>
          <Text style={[styles.icon, repeatMode !== 'off' && styles.iconActive]}>
            {repeatMode === 'one' ? '🔂' : '🔁'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#0d0d0d', paddingHorizontal: 24, paddingTop: 8},
  handleArea: {alignItems: 'center', paddingVertical: 10},
  handle: {width: 36, height: 4, borderRadius: 2, backgroundColor: '#ffffff4d'},
  artworkWrap: {alignItems: 'center', marginTop: 24, marginBottom: 32},
  artwork: {width: 280, height: 280, borderRadius: 16},
  artworkPlaceholder: {backgroundColor: '#2a2a2a'},
  title: {color: '#fff', fontSize: 20, fontWeight: '700', textAlign: 'center'},
  artist: {color: '#ffffffb3', fontSize: 15, textAlign: 'center', marginTop: 4, marginBottom: 24},
  timeRow: {flexDirection: 'row', justifyContent: 'space-between', marginTop: 4},
  timeText: {color: '#ffffff80', fontSize: 12},
  transportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 32,
    paddingHorizontal: 8,
  },
  icon: {fontSize: 20, color: '#ffffff80'},
  iconActive: {color: '#fff'},
  iconLarge: {fontSize: 28, color: '#fff'},
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: {fontSize: 26, color: '#000'},
});
