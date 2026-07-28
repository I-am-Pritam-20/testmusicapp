import React, {forwardRef, useImperativeHandle, useRef} from 'react';
import {FlatList, Image, Pressable, StyleSheet, Text, View} from 'react-native';
import Icon from '@react-native-vector-icons/material-design-icons';
import NativeBottomSheet, {type NativeBottomSheetHandle} from '../native-kit/NativeBottomSheet';
import type {AppTrack} from '../services/trackMapper';

export interface QueueSheetHandle {
  open: () => void;
  close: () => void;
}

export interface QueueSheetProps {
  heightFraction?: number;
  backgroundColor?: string;
  queue: AppTrack[];
  currentTrackId: string | null;
  isPlaying: boolean;
  onSelectTrack: (index: number) => void;
  onPlayPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
}

/**
 * Queue sheet on the universal native sheet shell — the slide and
 * drag-to-close are entirely native now (see NativeBottomSheetView.kt),
 * this only owns the content. The one thing that does need JS
 * involvement: the queue list scrolls internally, so the native
 * drag-to-close is disabled whenever the list isn't scrolled to the
 * top, otherwise scrolling through the queue and dragging the sheet
 * closed become ambiguous gestures that fight each other.
 */
const QueueSheet = forwardRef<QueueSheetHandle, QueueSheetProps>(
  (
    {heightFraction = 0.75, backgroundColor, queue, currentTrackId, isPlaying, onSelectTrack, onPlayPause, onNext, onPrevious},
    ref,
  ) => {
    const sheetRef = useRef<NativeBottomSheetHandle>(null);

    useImperativeHandle(ref, () => ({
      open: () => sheetRef.current?.expand(),
      close: () => sheetRef.current?.hide(),
    }));

    const currentTrack = queue.find(t => t.id === currentTrackId) ?? null;

    const handleScroll = (event: {nativeEvent: {contentOffset: {y: number}}}) => {
      const atTop = event.nativeEvent.contentOffset.y <= 0;
      sheetRef.current?.setDismissGestureEnabled(atTop);
    };

    return (
      <NativeBottomSheet
        ref={sheetRef}
        heightFraction={heightFraction}
        showBackdrop
        style={[styles.sheet, backgroundColor ? {backgroundColor} : null]}>
        <View style={styles.nowPlayingRow}>
          {currentTrack?.artworkUrl ? (
            <Image source={{uri: currentTrack.artworkUrl}} style={styles.artwork} />
          ) : (
            <View style={[styles.artwork, styles.artworkPlaceholder]} />
          )}
          <View style={styles.textBlock}>
            <Text style={styles.title} numberOfLines={1}>
              {currentTrack?.title ?? ''}
            </Text>
            <Text style={styles.artist} numberOfLines={1}>
              {currentTrack?.artist ?? ''}
            </Text>
          </View>
          <Pressable hitSlop={12} onPress={onPrevious}>
            <Icon name="skip-previous" color="#fff" size={26} />
          </Pressable>
          <Pressable hitSlop={12} onPress={onPlayPause} style={styles.playBtn}>
            <Icon name={isPlaying ? 'pause' : 'play'} color="#fff" size={26} />
          </Pressable>
          <Pressable hitSlop={12} onPress={onNext}>
            <Icon name="skip-next" color="#fff" size={26} />
          </Pressable>
        </View>
        <View style={styles.upNextRow}>
          <Text style={styles.upNextLabel}>UP NEXT</Text>
          <Pressable hitSlop={12} onPress={() => sheetRef.current?.hide()}>
            <Icon name="close" color="#fff" size={24} />
          </Pressable>
        </View>

        <FlatList
          style={styles.listWrap}
          data={queue}
          keyExtractor={t => t.id}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          renderItem={({item, index}) => (
            <Pressable
              style={[styles.trackRow, item.id === currentTrackId && styles.trackRowActive]}
              onPress={() => onSelectTrack(index)}>
              {item.artworkUrl ? (
                <Image source={{uri: item.artworkUrl}} style={styles.rowArtwork} />
              ) : (
                <View style={[styles.rowArtwork, styles.artworkPlaceholder]} />
              )}
              <View style={styles.textBlock}>
                <Text
                  style={[styles.rowTitle, item.id === currentTrackId && styles.rowTitleActive]}
                  numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.rowArtist} numberOfLines={1}>
                  {item.artist}
                </Text>
              </View>
            </Pressable>
          )}
        />
      </NativeBottomSheet>
    );
  },
);

export default QueueSheet;

const styles = StyleSheet.create({
  sheet: {backgroundColor: '#181818', borderTopLeftRadius: 20, borderTopRightRadius: 20},
  nowPlayingRow: {flexDirection: 'row', alignItems: 'center', padding: 16, gap: 10},
  artwork: {width: 48, height: 48, borderRadius: 8},
  artworkPlaceholder: {backgroundColor: '#333'},
  textBlock: {flex: 1},
  title: {color: '#fff', fontWeight: '600'},
  artist: {color: '#ffffffb3', marginTop: 2},
  playBtn: {marginHorizontal: 4},
  upNextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ffffff33',
  },
  upNextLabel: {color: '#ffffffb3', fontSize: 12, letterSpacing: 1},
  listWrap: {flex: 1},
  trackRow: {flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10},
  trackRowActive: {backgroundColor: '#ffffff14'},
  rowArtwork: {width: 40, height: 40, borderRadius: 6},
  rowTitle: {color: '#fff'},
  rowTitleActive: {color: '#7C4DFF'},
  rowArtist: {color: '#ffffffb3', marginTop: 2, fontSize: 12},
});
