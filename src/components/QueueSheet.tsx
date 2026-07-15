import React, {forwardRef, useImperativeHandle, useRef} from 'react';
import {FlatList, Image, Pressable, StyleSheet, Text, View} from 'react-native';
import {
  NativeViewGestureHandler,
  PanGestureHandler,
  State,
  type PanGestureHandlerGestureEvent,
  type PanGestureHandlerStateChangeEvent,
} from 'react-native-gesture-handler';
import Icon from '@react-native-vector-icons/material-design-icons';
import ModalSheet, {type ModalSheetHandle} from './ModalSheet';
import type {AppTrack} from '../services/trackMapper';

export interface QueueSheetHandle {
  open: () => void;
  close: () => void;
}

export interface QueueSheetProps {
  heightFraction?: number;
  queue: AppTrack[];
  currentTrackId: string | null;
  isPlaying: boolean;
  onSelectTrack: (index: number) => void;
  onPlayPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
}

/**
 * Close behaviors: (1) drag the header area above the list, (2) the X
 * button, (3) tap the dimmed backdrop, (4) scroll the list to its top and
 * keep dragging down. All four are equally reliable now: the list is
 * wrapped in a NativeViewGestureHandler and cross-linked via
 * simultaneousHandlers with a PanGestureHandler, so both gestures are
 * recognized concurrently instead of fighting for ownership — the pan
 * only actually triggers a close on release, and only when the list was
 * already scrolled to scrollY<=0.
 */
const QueueSheet = forwardRef<QueueSheetHandle, QueueSheetProps>(
  ({heightFraction = 0.75, queue, currentTrackId, isPlaying, onSelectTrack, onPlayPause, onNext, onPrevious}, ref) => {
    const sheetRef = useRef<ModalSheetHandle>(null);
    const scrollYRef = useRef(0);
    const nativeGestureRef = useRef(null);
    const panGestureRef = useRef(null);

    useImperativeHandle(ref, () => ({
      open: () => sheetRef.current?.open(),
      close: () => sheetRef.current?.close(),
    }));

    const currentTrack = queue.find(t => t.id === currentTrackId) ?? null;

    const handleListPanEvent = (_event: PanGestureHandlerGestureEvent) => {
      // No live-follow needed here — see handleListPanStateChange, which
      // acts only once the gesture ends.
    };

    const handleListPanStateChange = (event: PanGestureHandlerStateChangeEvent) => {
      const {state, translationY} = event.nativeEvent;
      if (state === State.END && scrollYRef.current <= 0 && translationY > 60) {
        sheetRef.current?.close();
      }
    };

    return (
      <ModalSheet
        ref={sheetRef}
        snapPoints={[heightFraction]}
        zIndex={30}
        header={
          <View>
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
              <Pressable hitSlop={12} onPress={() => sheetRef.current?.close()}>
                <Icon name="close" color="#fff" size={24} />
              </Pressable>
            </View>
          </View>
        }>
        <PanGestureHandler
          ref={panGestureRef}
          simultaneousHandlers={nativeGestureRef}
          onGestureEvent={handleListPanEvent}
          onHandlerStateChange={handleListPanStateChange}
          activeOffsetY={10}
          failOffsetX={[-20, 20]}>
          <View style={styles.listWrap}>
            <NativeViewGestureHandler ref={nativeGestureRef} simultaneousHandlers={panGestureRef}>
              <FlatList
                data={queue}
                keyExtractor={t => t.id}
                onScroll={e => {
                  scrollYRef.current = e.nativeEvent.contentOffset.y;
                }}
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
            </NativeViewGestureHandler>
          </View>
        </PanGestureHandler>
      </ModalSheet>
    );
  },
);

export default QueueSheet;

const styles = StyleSheet.create({
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
  rowTitleActive: {color: '#1db954'},
  rowArtist: {color: '#ffffffb3', marginTop: 2, fontSize: 12},
});
