import React from 'react';
import {Image, Pressable, StyleSheet, Text, View} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SeekBar from './SeekBar';
import Icon from '@react-native-vector-icons/material-design-icons';
import LinearGradient from 'react-native-linear-gradient';

export interface FullPlayerScreenProps {
  
  bgColor: string;
  title: string;
  artist: string;
  artworkUrl?: string;
  isPlaying: boolean;
  positionMs: number;
  durationMs: number;
  isShuffleEnabled: boolean;
  repeatMode: 'off' | 'one' | 'once';
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
    bgColor,
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
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container,]}>
    <LinearGradient style={[styles.gradientContainer, {paddingTop: insets.top, paddingBottom: insets.bottom}]}
    colors={[`${bgColor}`, '#000000']}>
      <Pressable style={styles.handleArea} onPress={onCollapse}>
        <View style={styles.handle} />
      </Pressable>

      <View style={styles.header}>
        <Icon name='chevron-down' color={'#fff'} size={32} onPress={onCollapse}/>
        <Text style={styles.headerTxt}>NOW PLAYING</Text>
        <Icon name='dots-vertical' color={'#fff'} size={28}/>
      </View>

      <View style={styles.artworkWrap}>
        {artworkUrl ? (
          <Image source={{uri: artworkUrl}} style={styles.artwork} />
        ) : (
          <View style={[styles.artwork, styles.artworkPlaceholder]} />
        )}
      </View>

      <Text style={styles.title} numberOfLines={1}>
        {title || 'Not playing'}
      </Text>
      <Text style={styles.artist} numberOfLines={1}>
        {artist}
      </Text>

      <SeekBar positionMs={positionMs} durationMs={durationMs} onSeek={onSeek} />
      <View style={styles.timeRow}>
        <Text style={styles.timeText}>{formatTime(positionMs)}</Text>
        <Text style={styles.timeText}>{formatTime(durationMs)}</Text>
      </View>

      <View style={styles.playerControls}>
        <Pressable onPress={onToggleShuffle}>
          <Icon name='shuffle' color={isShuffleEnabled? '#fff' : '#ffffff80'} size={28}/>
        </Pressable>
        <Pressable onPress={onPrevious}>
          <Icon name='skip-previous' color={'#fff'} size={38}/>
        </Pressable>
        <Pressable onPress={onPlayPause}>
          <Icon name={isPlaying? 'pause-circle' : 'play-circle'} color={'#fff'} size={72}/>
        </Pressable>
        <Pressable onPress={onNext}>
          <Icon name='skip-next' color={'#fff'} size={38}/>
        </Pressable>
        <Pressable onPress={onCycleRepeat}>
          <Icon name={repeatMode === 'once' ? 'repeat-once' : 'repeat'} color={repeatMode !== 'off' ? '#fff' : '#ffffff80'} size={28}/>
        </Pressable>
      </View>
    </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden'},
  gradientContainer: {flex: 1, paddingHorizontal: 16, paddingTop: 8,},
  handleArea: {alignItems: 'center', paddingVertical: 10},
  handle: {width: 36, height: 4, borderRadius: 2, backgroundColor: '#ffffff4d'},
  header: {alignItems: 'center', justifyContent: 'space-between', flexDirection: 'row'},
  headerTxt: {color: '#ffffffcc', fontSize: 12, letterSpacing: 1.5},
  artworkWrap: {alignItems: 'center', marginTop: 24, marginBottom: 32, paddingTop: 24},
  artwork: {width: 320, height: 320, borderRadius: 12, boxShadow: '0px 0px 32px #1b1b1bca'},
  artworkPlaceholder: {backgroundColor: '#2a2a2a'},
  title: {color: '#fff', fontSize: 20, fontWeight: '700', },
  artist: {color: '#ffffffb3', fontSize: 15, marginTop: 4, marginBottom: 24},
  timeRow: {flexDirection: 'row', justifyContent: 'space-between', marginTop: 4},
  timeText: {color: '#ffffff80', fontSize: 12},
  playerControls: {
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