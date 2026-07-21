import React from 'react';
import {Image, Pressable, StyleSheet, Text, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import SeekBar from './SeekBar';
import Icon from '@react-native-vector-icons/material-design-icons';

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
  onOpenQueue: () => void;
  onOpenSleepTimer: () => void;
  onOpenMenu: () => void;
  isLiked: boolean;
  onToggleLiked: () => void;
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
    onOpenQueue,
    onOpenSleepTimer,
    onOpenMenu,
    isLiked,
    onToggleLiked,
  } = props;
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, ]}>
      {/* Purely a visual background layer. LinearGradient's own measure/
          sizing behavior isn't reliable as a flex layout container (rows
          using justifyContent/parent width can collapse), so it never
          holds any content — it just paints a rect behind everything,
          while the View above still does all the real flex layout. */}
      <LinearGradient
        colors={[bgColor, '#000000']}
        start={{x: 0, y: 0}}
        end={{x: 0, y: 1}}
        style={[styles.gradientBackground, 
          {paddingTop: insets.top + 8,
          paddingBottom: insets.bottom,
          paddingHorizontal: 14
        }]}
      >

      <View style={styles.header}>
        <Icon name="chevron-down" color={'#fff'} size={32} onPress={onCollapse} />
        <Text style={styles.headerTxt}>NOW PLAYING</Text>
        <Icon name="dots-vertical" color={'#fff'} size={28} onPress={onOpenMenu} />
      </View>

      <View style={styles.artworkWrap}>
        {artworkUrl ? (
          <Image source={{uri: artworkUrl}} style={styles.artwork} />
        ) : (
          <View style={[styles.artwork, styles.artworkPlaceholder]} />
        )}
      </View>

      <View style={styles.titleRow}>
        <View style={styles.titleTextBlock}>
          <Text style={styles.title} numberOfLines={1}>
            {title || 'Not playing'}
          </Text>
          <Text style={styles.artist} numberOfLines={1}>
            {artist}
          </Text>
        </View>
        <Pressable hitSlop={12} onPress={onToggleLiked}>
          <Icon name={isLiked ? 'heart' : 'heart-outline'} color={isLiked ? '#1db954' : '#ffffffcc'} size={26} />
        </Pressable>
      </View>

      <SeekBar positionMs={positionMs} durationMs={durationMs} onSeek={onSeek} />
      <View style={styles.timeRow}>
        <Text style={styles.timeText}>{formatTime(positionMs)}</Text>
        <Text style={styles.timeText}>{formatTime(durationMs)}</Text>
      </View>

      <View style={styles.playerControls}>
        <Pressable onPress={onToggleShuffle}>
          <Icon name="shuffle" color={isShuffleEnabled ? '#fff' : '#ffffff80'} size={28} />
        </Pressable>
        <Pressable onPress={onPrevious}>
          <Icon name="skip-previous" color={'#fff'} size={38} />
        </Pressable>
        <Pressable onPress={onPlayPause}>
          <Icon name={isPlaying ? 'pause-circle' : 'play-circle'} color={'#fff'} size={72} />
        </Pressable>
        <Pressable onPress={onNext}>
          <Icon name="skip-next" color={'#fff'} size={38} />
        </Pressable>
        <Pressable onPress={onCycleRepeat}>
          <Icon
            name={repeatMode === 'once' ? 'repeat-once' : 'repeat'}
            color={repeatMode !== 'off' ? '#fff' : '#ffffff80'}
            size={28}
          />
        </Pressable>
      </View>

      <View style={styles.secondaryRow}>
        <Pressable onPress={onOpenSleepTimer} style={styles.secondaryBtn}>
          <Icon name="timer-outline" color={'#ffffffcc'} size={22} />
        </Pressable>
        <Pressable onPress={onOpenQueue} style={styles.secondaryBtn}>
          <Icon name="playlist-music" color={'#ffffffcc'} size={22} />
        </Pressable>
      </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, 
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden'
  },
  gradientBackground: {
    flex: 1,
  },
  handleArea: {alignItems: 'center', paddingVertical: 10},
  handle: {width: 36, height: 4, borderRadius: 2, backgroundColor: '#ffffff4d'},
  header: {alignItems: 'center', justifyContent: 'space-between', flexDirection: 'row'},
  headerTxt: {color: '#ffffffcc', fontSize: 12, letterSpacing: 1.5},
  artworkWrap: {alignItems: 'center', marginTop: 24, marginBottom: 32, paddingTop: 24},
  artwork: {width: 320, height: 320, borderRadius: 12, boxShadow: '0px 0px 32px #666666ca'},
  artworkPlaceholder: {backgroundColor: '#2a2a2a'},
  title: {color: '#fff', fontSize: 20, fontWeight: '700'},
  artist: {color: '#ffffffb3', fontSize: 15, marginTop: 4},
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  titleTextBlock: {flex: 1, marginRight: 12},
  timeRow: {flexDirection: 'row', justifyContent: 'space-between', marginTop: 4},
  timeText: {color: '#ffffff80', fontSize: 12},
  playerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingHorizontal: 8,
  },
  secondaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 32,
    marginTop: 16,
  },
  secondaryBtn: {padding: 8},
});
