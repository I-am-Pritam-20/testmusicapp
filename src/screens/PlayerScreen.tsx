import React, {useEffect, useRef, useState} from 'react';
import {StyleSheet, View, ScrollView, Image, Text, Pressable} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import NativeBottomSheet, {type NativeBottomSheetHandle} from '../native-kit/NativeBottomSheet';
import MusicPlayer, {type PlaybackStateEvent} from '../native-kit/MusicPlayer';
import {sampleQueue} from '../data/data';
import MiniPlayerBar from '../components/MiniPlayerBar';
import FullPlayerScreen from '../components/FullPlayerScreen';

const MINI_PLAYER_HEIGHT = 64;
const MINI_PLAYER_BOTTOM = 10;

export default function PlayerScreen(): React.JSX.Element {
  const sheetRef = useRef<NativeBottomSheetHandle>(null);
  const [state, setState] = useState<PlaybackStateEvent | null>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const unsubscribe = MusicPlayer.onPlaybackState(setState);
    return unsubscribe;
  }, []);

  const currentTrack = sampleQueue.find(t => t.id === state?.currentTrackId) ?? null;
  const isPlaying = state?.status === 'playing';

  const handleCardPress = (index: number) => {
    // Whole list becomes the queue, starting at the tapped card. Plays
    // immediately and just updates the mini player — matches Spotify,
    // which doesn't auto-expand the full sheet on a list tap.
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
        contentContainerStyle={[
          styles.scrollContent,
          {paddingBottom: MINI_PLAYER_HEIGHT + MINI_PLAYER_BOTTOM + insets.bottom + 16},
        ]}>
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

      {/* Always-visible mini player — lives OUTSIDE the sliding sheet, so
          it's never moved or touch-blocked by it. Tapping it is the ONLY
          way to open the full player; there's no drag-to-expand. */}
      <MiniPlayerBar
        bgColor={currentTrack?.bgColor ?? '#161616'}
        title={currentTrack?.title ?? ''}
        artist={currentTrack?.artist ?? ''}
        artworkUrl={currentTrack?.artworkUrl}
        isPlaying={isPlaying}
        insetBottom={insets.bottom}
        onPress={() => sheetRef.current?.expand()}
        onPlayPause={() => (isPlaying ? MusicPlayer.pause() : MusicPlayer.resume())}
        onNext={() => MusicPlayer.skipToNext()}
      />

      {/* Full player sheet — higher zIndex/elevation than the mini player,
          so it slides up and covers it entirely. Pure translateY slide,
          no opacity animation of any kind. */}
      <NativeBottomSheet ref={sheetRef} initialState="hidden" style={styles.sheet}>
        <FullPlayerScreen
          bgColor={currentTrack?.bgColor ?? '#141414'}
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
      </NativeBottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#000000'},
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
  sheet: {zIndex: 10, elevation: 10},
});