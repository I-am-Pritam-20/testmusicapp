import React, {useEffect, useRef, useState} from 'react';
import {Animated, StyleSheet, View, ScrollView, Image, Text, Pressable} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import NativeBottomSheet, {type NativeBottomSheetHandle} from '../native-kit/NativeBottomSheet';
import MusicPlayer, {type PlaybackStateEvent} from '../native-kit/MusicPlayer';
import type {TrackPayload} from '../native-kit/specs/NativeMusicPlayerModule';
import MiniPlayerBar from '../components/MiniPlayerBar';
import FullPlayerScreen from '../components/FullPlayerScreen';

const BASE_COLLAPSED_HEIGHT = 64;

// Replace the jiosaavn `url` with a real resolved stream URL from your
// JioSaavn API integration before testing — a jiosaavn.com song PAGE link
// isn't playable audio. The local url must be a path this app can actually
// read (see native-kit/permissions.ts) — spaces are percent-encoded here.
const sampleQueue: TrackPayload[] = [
  {
    id: 'jiosaavn-1',
    url: 'REPLACE_WITH_RESOLVED_JIOSAAVN_STREAM_URL',
    sourceType: 'jiosaavn',
    title: 'Gehra Hua (From "Dhurandhar")',
    artist: 'Arijit Singh',
    artworkUrl: 'https://c.saavncdn.com/450/Gehra-Hua-From-Dhurandhar-Hindi-2025-20251205154217-500x500.jpg',
  },
  {
    id: 'local-1',
    url: 'file:///storage/emulated/0/My%20Music/Tum%20Ho%20Toh(From%20Saiyaara).mp3',
    sourceType: 'local',
    title: 'Tum Ho Toh (From Saiyaara)',
    artist: 'Vishal Mishra',
    artworkUrl: 'https://c.saavncdn.com/598/Saiyaara-Hindi-2025-20250703061754-500x500.jpg',
  },
];

export default function PlayerScreen(): React.JSX.Element {
  const sheetRef = useRef<NativeBottomSheetHandle>(null);
  const [state, setState] = useState<PlaybackStateEvent | null>(null);
  const slideProgress = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();
  const collapsedHeight = BASE_COLLAPSED_HEIGHT + insets.bottom;

  useEffect(() => {
    const unsubscribe = MusicPlayer.onPlaybackState(setState);
    return unsubscribe;
  }, []);

  const currentTrack =
    sampleQueue.find(t => t.id === state?.currentTrackId) ?? null;
  const isPlaying = state?.status === 'playing';

  const handleSlide = (progress: number) => {
    slideProgress.setValue(progress);
  };

  const handleCardPress = (index: number) => {
    // Whole list becomes the queue, starting at the tapped card — Spotify
    // plays the track immediately and just updates the mini player; it
    // does NOT auto-expand the full sheet, so we don't either.
    MusicPlayer.setQueue(sampleQueue, index);
  };

  const handleRepeatCycle = () => {
    const order: Array<'off' | 'one' | 'all'> = ['off', 'all', 'one'];
    const currentIndex = order.indexOf(state?.repeatMode ?? 'off');
    MusicPlayer.setRepeatMode(order[(currentIndex + 1) % order.length]);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={[styles.scrollViewc, {paddingTop: insets.top}]}
        contentContainerStyle={[styles.scrollContent, {paddingBottom: collapsedHeight + 16}]}>
        {sampleQueue.map((track, index) => {
          const isCurrent = track.id === state?.currentTrackId;
          return (
            <Pressable
              key={track.id}
              style={[styles.trackCard, isCurrent && styles.trackCardActive]}
              onPress={() => handleCardPress(index)}>
              {track.artworkUrl ? (
                <Image source={{uri: track.artworkUrl}} style={styles.trackImage} resizeMode="contain" />
              ) : (
                <Image
                  source={require('../assets/track_placeholder.png')}
                  style={styles.trackImage}
                  resizeMode="contain"
                />
              )}
              <View style={styles.trackInfo}>
                <Text style={[styles.trackTitle, isCurrent && styles.trackTitleActive]}>{track.title}</Text>
                <Text style={styles.trackArtist}>{track.artist}</Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      <NativeBottomSheet
        ref={sheetRef}
        collapsedHeight={collapsedHeight}
        initialState="collapsed"
        onSlide={handleSlide}>
        <View style={StyleSheet.absoluteFill}>
          <Animated.View
            pointerEvents="box-none"
            style={[
              styles.layer,
              {
                opacity: slideProgress.interpolate({
                  inputRange: [0, 0.5],
                  outputRange: [1, 0],
                  extrapolate: 'clamp',
                }),
              },
            ]}>
            <MiniPlayerBar
              title={currentTrack?.title ?? ''}
              artist={currentTrack?.artist ?? ''}
              artworkUrl={currentTrack?.artworkUrl}
              isPlaying={isPlaying}
              insetBottom={insets.bottom}
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
                  inputRange: [0.5, 1],
                  outputRange: [0, 1],
                  extrapolate: 'clamp',
                }),
              },
            ]}>
            <FullPlayerScreen
              title={currentTrack?.title ?? ''}
              artist={currentTrack?.artist ?? ''}
              artworkUrl={currentTrack?.artworkUrl}
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
  container: {flex: 1, backgroundColor: '#080029'},
  scrollViewc: {flex: 1},
  scrollContent: {paddingHorizontal: 14, gap: 14},
  trackCard: {
    alignItems: 'center',
    padding: 10,
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#777',
    backgroundColor: '#666666aa',
    gap: 10,
  },
  trackCardActive: {borderColor: '#1db954'},
  trackImage: {height: 48, width: 48, borderRadius: 6},
  trackInfo: {alignSelf: 'flex-start'},
  trackTitle: {color: '#fff', fontWeight: '600'},
  trackTitleActive: {color: '#1db954'},
  trackArtist: {color: '#ffffffb3', marginTop: 6},
  layer: {...StyleSheet.absoluteFillObject},
});