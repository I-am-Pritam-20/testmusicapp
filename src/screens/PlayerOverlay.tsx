import React, {useRef} from 'react';
import {StyleSheet, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import NativeBottomSheet, {type NativeBottomSheetHandle} from '../native-kit/NativeBottomSheet';
import MusicPlayer from '../native-kit/MusicPlayer';
import {usePlaybackQueue} from '../context/PlaybackQueueContext';
import MiniPlayerBar from '../components/MiniPlayerBar';
import FullPlayerScreen from '../components/FullPlayerScreen';
import QueueSheet, {type QueueSheetHandle} from '../components/QueueSheet';
import SleepTimerSheet, {type SleepTimerSheetHandle} from '../components/SleepTimerSheet';
import MenuSheet, {type MenuSheetHandle} from '../components/MenuSheet';
import {LibraryService} from '../services/LibraryService';
import {TAB_BAR_HEIGHT} from '../navigation/RootNavigator';
import {Z_INDEX} from '../constants/zIndex';

/**
 * Persistent player UI, rendered as a sibling of the tab/stack navigator
 * (see App.tsx) rather than as a screen — it needs to stay visible and in
 * sync across Home/Search/Library, all of which read the current queue
 * from PlaybackQueueContext instead of a static list.
 */
export default function PlayerOverlay(): React.JSX.Element {
  const sheetRef = useRef<NativeBottomSheetHandle>(null);
  const queueSheetRef = useRef<QueueSheetHandle>(null);
  const sleepTimerSheetRef = useRef<SleepTimerSheetHandle>(null);
  const menuSheetRef = useRef<MenuSheetHandle>(null);
  const insets = useSafeAreaInsets();
  const {tracks, currentTrack, state, setFullPlayerOpen} = usePlaybackQueue();

  const isPlaying = state?.isPlaying ?? false;

  const handleRepeatCycle = () => {
    const order: Array<'off' | 'one' | 'once'> = ['off', 'one', 'once'];
    const currentIndex = order.indexOf(state?.repeatMode ?? 'off');
    MusicPlayer.setRepeatMode(order[(currentIndex + 1) % order.length]);
  };

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <MiniPlayerBar
        bgColor={currentTrack?.bgColor ?? '#161616'}
        title={currentTrack?.title ?? ''}
        artist={currentTrack?.artist ?? ''}
        artworkUrl={currentTrack?.artworkUrl}
        isPlaying={isPlaying}
        insetBottom={TAB_BAR_HEIGHT + insets.bottom}
        onPress={() => sheetRef.current?.expand()}
        onPlayPause={() => (isPlaying ? MusicPlayer.pause() : MusicPlayer.resume())}
        onNext={() => MusicPlayer.skipToNext()}
      />

      <NativeBottomSheet
        ref={sheetRef}
        initialState="hidden"
        style={styles.sheet}
        onStateChange={s => setFullPlayerOpen(s === 'expanded')}>
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
          isLiked={currentTrack ? LibraryService.isSongLiked(currentTrack.id) : false}
          onToggleLiked={() => currentTrack && LibraryService.toggleLikedSong(currentTrack)}
          onCollapse={() => sheetRef.current?.collapse()}
          onPlayPause={() => (isPlaying ? MusicPlayer.pause() : MusicPlayer.resume())}
          onNext={() => MusicPlayer.skipToNext()}
          onPrevious={() => MusicPlayer.skipToPrevious()}
          onSeek={ms => MusicPlayer.seekTo(ms)}
          onToggleShuffle={() => MusicPlayer.setShuffleEnabled(!(state?.isShuffleEnabled ?? false))}
          onCycleRepeat={handleRepeatCycle}
          onOpenQueue={() => queueSheetRef.current?.open()}
          onOpenSleepTimer={() => sleepTimerSheetRef.current?.open()}
          onOpenMenu={() => menuSheetRef.current?.open()}
        />
      </NativeBottomSheet>

      <QueueSheet
        ref={queueSheetRef}
        heightFraction={0.75}
        queue={tracks}
        currentTrackId={state?.currentTrackId ?? null}
        isPlaying={isPlaying}
        onSelectTrack={index => MusicPlayer.setQueue(tracks, index)}
        onPlayPause={() => (isPlaying ? MusicPlayer.pause() : MusicPlayer.resume())}
        onNext={() => MusicPlayer.skipToNext()}
        onPrevious={() => MusicPlayer.skipToPrevious()}
        backgroundColor={currentTrack?.bgColor ?? '#000000'}
      />

      <SleepTimerSheet ref={sleepTimerSheetRef} heightFraction={0.45} />

      {/* Placeholder actions — wire "Add to Playlist" to a playlist picker
          once you're ready; the rest are simple stubs. */}
      <MenuSheet
        ref={menuSheetRef}
        snapFractions={[0.75, 0.5, 0.25]}
        options={[
          {icon: 'playlist-plus', label: 'Add to Playlist', onPress: () => menuSheetRef.current?.close()},
          {icon: 'account-music', label: 'View Artist', onPress: () => menuSheetRef.current?.close()},
          {icon: 'album', label: 'View Album', onPress: () => menuSheetRef.current?.close()},
          {icon: 'share-variant', label: 'Share', onPress: () => menuSheetRef.current?.close()},
          {icon: 'information-outline', label: 'Song Info', onPress: () => menuSheetRef.current?.close()},
          {icon: 'download', label: 'Download', onPress: () => menuSheetRef.current?.close()},
          {icon: 'equalizer', label: 'Equalizer', onPress: () => menuSheetRef.current?.close()},
          {icon: 'flag-outline', label: 'Report a Problem', onPress: () => menuSheetRef.current?.close()},
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {zIndex: Z_INDEX.fullPlayer, elevation: 16},
});
