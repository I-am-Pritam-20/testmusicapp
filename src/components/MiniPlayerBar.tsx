import React, {memo, useCallback} from 'react';
import {Image, Pressable, StyleSheet, Text, View} from 'react-native';
import Svg, {Circle} from 'react-native-svg';
import Icon from '@react-native-vector-icons/material-design-icons';
import {usePlaybackQueue} from '../context/PlaybackQueueContext';
import {useAppearance} from '../context/AppearanceContext';
import MusicPlayer from '../native-kit/MusicPlayer';
import {getContrastText} from '../theme/colors';
import {Z_INDEX} from '../constants/zIndex';

const IMG = 40;
const STROKE = 2;
const SVG_SIZE = IMG + STROKE * 2 + 4;
const CENTER = SVG_SIZE / 2;
const RADIUS = IMG / 2 + STROKE / 2 + 1;
const CIRC = 2 * Math.PI * RADIUS;

/** Plain SVG ring, no Reanimated/native animation driving it — position
 *  updates every ~500ms from playback state and that's fast enough for
 *  a progress indicator; keeping it off the animation system entirely
 *  avoids any interaction with the sheet/toast animation rules below. */
const ProgressRing = memo(function ProgressRing({progress, color}: {progress: number; color: string}) {
  const dashOffset = CIRC * (1 - Math.max(0, Math.min(1, progress)));
  return (
    <Svg width={SVG_SIZE} height={SVG_SIZE} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Circle cx={CENTER} cy={CENTER} r={RADIUS} stroke="rgba(255,255,255,0.15)" strokeWidth={STROKE} fill="none" />
      <Circle
        cx={CENTER}
        cy={CENTER}
        r={RADIUS}
        stroke={color}
        strokeWidth={STROKE}
        fill="none"
        strokeDasharray={`${CIRC} ${CIRC}`}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        transform={`rotate(-90 ${CENTER} ${CENTER})`}
      />
    </Svg>
  );
});

export interface MiniPlayerBarProps {
  onExpand: () => void;
  /** Distance from the screen bottom to float above — the tab bar height
   *  plus safe-area inset, computed by the parent (PlayerOverlay) since
   *  it already needs that same number for its own layout. */
  bottomOffset: number;
}

/**
 * Floating pill-shaped mini player, ported from inotuneoffline's real
 * MiniPlayer.tsx: a plain View (not Animated.View) with borderRadius:
 * 999 for the pill shape and a dynamic backgroundColor — color changes
 * are a normal re-render, not an animated transition, which is what
 * keeps this safe under the no-overflow-hidden-transform-borderRadius
 * crash rule. A circular SVG progress ring wraps the artwork instead of
 * a linear bar underneath.
 */
function MiniPlayerBarInner({onExpand, bottomOffset}: MiniPlayerBarProps): React.JSX.Element | null {
  const {currentTrack, state} = usePlaybackQueue();
  const {tokens, dominantColor} = useAppearance();

  const onPressPlayPause = useCallback(
    (e: {stopPropagation: () => void}) => {
      e.stopPropagation();
      if (state?.isPlaying) MusicPlayer.pause();
      else MusicPlayer.resume();
    },
    [state?.isPlaying],
  );

  const onPressNext = useCallback((e: {stopPropagation: () => void}) => {
    e.stopPropagation();
    MusicPlayer.skipToNext();
  }, []);

  if (!currentTrack) return null;

  const progress = state && state.durationMs > 0 ? state.positionMs / state.durationMs : 0;
  const bg = tokens.miniPlayerBg ?? dominantColor;
  const tc = getContrastText(bg);

  return (
    <View
      style={[
        styles.container,
        {bottom: bottomOffset, backgroundColor: bg, shadowColor: bg},
      ]}>
      <Pressable style={styles.touchable} onPress={onExpand}>
        <View style={styles.artOuter}>
          <ProgressRing progress={progress} color={tc} />
          {currentTrack.artworkUrl ? (
            <Image source={{uri: currentTrack.artworkUrl}} style={styles.art} fadeDuration={100} />
          ) : (
            <View style={styles.artFallback}>
              <Icon name="music-note" size={18} color="rgba(255,255,255,0.7)" />
            </View>
          )}
        </View>

        <View style={styles.info}>
          <Text style={[styles.title, {color: tc}]} numberOfLines={1}>
            {currentTrack.title}
          </Text>
          <Text style={[styles.artist, {color: tc}]} numberOfLines={1}>
            {currentTrack.artist}
          </Text>
        </View>

        <View style={styles.controls}>
          <Pressable onPress={onPressPlayPause} hitSlop={{top: 12, bottom: 12, left: 12, right: 6}}>
            <Icon name={state?.isPlaying ? 'pause' : 'play'} size={24} color={tc} />
          </Pressable>
          <Pressable onPress={onPressNext} hitSlop={{top: 12, bottom: 12, left: 6, right: 12}}>
            <Icon name="skip-next" size={26} color={tc} />
          </Pressable>
        </View>
      </Pressable>
    </View>
  );
}

export default memo(MiniPlayerBarInner, (prev, next) => prev.onExpand === next.onExpand && prev.bottomOffset === next.bottomOffset);

const styles = StyleSheet.create({
  // Plain View, borderRadius: 999 for the pill — no Animated.View, no
  // overflow:'hidden'. Color changes are a plain backgroundColor prop
  // update on re-render, never an animated transition.
  container: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: Z_INDEX.chrome,
    elevation: 8,
    borderRadius: 999,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  touchable: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 6,
    gap: 10,
  },
  artOuter: {width: SVG_SIZE, height: SVG_SIZE, justifyContent: 'center', alignItems: 'center', position: 'relative'},
  art: {width: IMG, height: IMG, borderRadius: IMG / 2, position: 'absolute'},
  artFallback: {
    width: IMG,
    height: IMG,
    borderRadius: IMG / 2,
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: {flex: 1},
  title: {fontSize: 13, fontWeight: '700'},
  artist: {fontSize: 12, fontWeight: '400', marginTop: 1},
  controls: {flexDirection: 'row', alignItems: 'center', gap: 16, marginRight: 10},
});
