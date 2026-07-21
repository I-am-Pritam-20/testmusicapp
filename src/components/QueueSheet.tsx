import React, {forwardRef, useImperativeHandle, useRef} from 'react';
import {Image, Pressable, StyleSheet, Text, View} from 'react-native';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import Animated, {useAnimatedScrollHandler, useSharedValue} from 'react-native-reanimated';
import Icon from '@react-native-vector-icons/material-design-icons';
import ModalSheet, {type ModalSheetHandle} from './ModalSheet';
import {Z_INDEX} from '../constants/zIndex';
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

const AnimatedFlatList = Animated.createAnimatedComponent(require('react-native').FlatList);

const QueueSheet = forwardRef<QueueSheetHandle, QueueSheetProps>(
  (
    {heightFraction = 0.75, backgroundColor, queue, currentTrackId, isPlaying, onSelectTrack, onPlayPause, onNext, onPrevious},
    ref,
  ) => {
    const sheetRef = useRef<ModalSheetHandle>(null);
    const scrollY = useSharedValue(0);

    useImperativeHandle(ref, () => ({
      open: () => sheetRef.current?.open(),
      close: () => sheetRef.current?.close(),
    }));

    const currentTrack = queue.find(t => t.id === currentTrackId) ?? null;

    const scrollHandler = useAnimatedScrollHandler(event => {
      scrollY.value = event.contentOffset.y;
    });

    const nativeGesture = Gesture.Native();
    const dismissPan = Gesture.Pan()
      .onEnd(event => {
        if (scrollY.value <= 0 && event.translationY > 60) {
          sheetRef.current?.close();
        }
      })
      .activeOffsetY(10)
      .failOffsetX([-20, 20]);
    const composedGesture = Gesture.Simultaneous(nativeGesture, dismissPan);

    return (
      <ModalSheet
        ref={sheetRef}
        snapPoints={[heightFraction]}
        zIndex={Z_INDEX.stackedSheets}
        backgroundColor={backgroundColor}
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
        <GestureDetector gesture={composedGesture}>
          <View style={styles.listWrap}>
            <AnimatedFlatList
              data={queue}
              keyExtractor={(t: AppTrack) => t.id}
              onScroll={scrollHandler}
              scrollEventThrottle={16}
              renderItem={({item, index}: {item: AppTrack; index: number}) => (
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
          </View>
        </GestureDetector>
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