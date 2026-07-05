import React, {useEffect, useRef, useState} from 'react';
import {Animated, SafeAreaView, StyleSheet, View} from 'react-native';
import NativeBottomSheet, {type NativeBottomSheetHandle} from '../native-kit/NativeBottomSheet';
import MusicPlayer, {type PlaybackStateEvent} from '../native-kit/MusicPlayer';
import type {TrackPayload} from '../native-kit/specs/NativeMusicPlayerModule';
import MiniPlayerBar from '../components/MiniPlayerBar';
import FullPlayerScreen from '../components/FullPlayerScreen';

const COLLAPSED_HEIGHT = 64;

// A JioSaavn track's `url` here is assumed already resolved to a playable
// stream URL (via your existing JioSaavn API integration) — the native
// side doesn't know or care that it came from JioSaavn vs. local storage,
// it just needs a final playable URI either way.
const sampleQueue: TrackPayload[] = [
  {
    id: 'jiosaavn-1',
    url: 'https://www.jiosaavn.com/song/gehra-hua-from-dhurandhar/KQE9fDgEbVw',
    sourceType: 'jiosaavn',
    title: 'Gehra Hua (From "Dhurandhar")',
    artist: 'Arijit Singh',
    artworkUrl: 'https://c.saavncdn.com/450/Gehra-Hua-From-Dhurandhar-Hindi-2025-20251205154217-500x500.jpg',
  },
  {
    id: 'local-1',
    url: 'file:///storage/emulated/0/My Music/Tum Ho Toh(From Saiyaara).mp3',
    sourceType: 'local',
    title: 'Tum Ho Toh (From Saiyaara)',
    artist: 'Vishal Mishra',
    artworkUrl: 'https://c.saavncdn.com/598/Saiyaara-Hindi-2025-20250703061754-500x500.jpg'
  },
];

export default function PlayerScreen(): React.JSX.Element {
  const sheetRef = useRef<NativeBottomSheetHandle>(null);
  const [state, setState] = useState<PlaybackStateEvent | null>(null);
  const slideProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    MusicPlayer.setQueue(sampleQueue, 0);
    const unsubscribe = MusicPlayer.onPlaybackState(setState);
    return unsubscribe;
  }, []);

  const currentTrack =
    sampleQueue.find(t => t.id === state?.currentTrackId) ?? sampleQueue[0];
  const isPlaying = state?.status === 'playing';

  const handleSlide = (progress: number) => {
    slideProgress.setValue(progress);
  };

  const handleRepeatCycle = () => {
    const order: Array<'off' | 'one' | 'all'> = ['off', 'all', 'one'];
    const currentIndex = order.indexOf(state?.repeatMode ?? 'off');
    MusicPlayer.setRepeatMode(order[(currentIndex + 1) % order.length]);
  };

  return (
    <View style={styles.container}>
      {/* The rest of your app's screens render behind the sheet here. */}

      <NativeBottomSheet
        ref={sheetRef}
        collapsedHeight={COLLAPSED_HEIGHT}
        initialState="collapsed"
        onSlide={handleSlide}>
        <View style={StyleSheet.absoluteFill}>
          <Animated.View
            pointerEvents="box-none"
            style={[
              styles.layer,
              {
                opacity: slideProgress.interpolate({
                  inputRange: [0, 0.4],
                  outputRange: [1, 0],
                  extrapolate: 'clamp',
                }),
              },
            ]}>
            <MiniPlayerBar
              title={currentTrack.title}
              artist={currentTrack.artist}
              artworkUrl={currentTrack.artworkUrl}
              isPlaying={isPlaying}
              onPress={() => sheetRef.current?.expand()}
              onPlayPause={() => (isPlaying ? MusicPlayer.pause() : MusicPlayer.resume())}
              onNext={() => MusicPlayer.skipToNext()}
            />
          </Animated.View>

          <Animated.View
            pointerEvents="box-none"
            style={[
              styles.layer,
              {
                opacity: slideProgress.interpolate({
                  inputRange: [0.6, 1],
                  outputRange: [0, 1],
                  extrapolate: 'clamp',
                }),
              },
            ]}>
            <FullPlayerScreen
              title={currentTrack.title}
              artist={currentTrack.artist}
              artworkUrl={currentTrack.artworkUrl}
              isPlaying={isPlaying}
              positionMs={state?.positionMs ?? 0}
              durationMs={state?.durationMs ?? 0}
              isShuffleEnabled={state?.isShuffleEnabled ?? false}
              repeatMode={state?.repeatMode ?? 'off'}
              onCollapse={() => sheetRef.current?.collapse()}
              onPlayPause={() => (isPlaying ? MusicPlayer.pause() : MusicPlayer.resume())}
              onNext={() => MusicPlayer.skipToNext()}
              onPrevious={() => MusicPlayer.skipToPrevious()}
              onSeek={ms => MusicPlayer.seekTo(ms)}
              onToggleShuffle={() => MusicPlayer.setShuffleEnabled(!(state?.isShuffleEnabled ?? false))}
              onCycleRepeat={handleRepeatCycle}
            />
          </Animated.View>
        </View>
      </NativeBottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#000'},
  layer: {...StyleSheet.absoluteFillObject},
});
