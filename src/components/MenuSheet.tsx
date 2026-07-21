import React, {forwardRef, useImperativeHandle, useRef} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import Animated, {useAnimatedScrollHandler, useSharedValue} from 'react-native-reanimated';
import Icon from '@react-native-vector-icons/material-design-icons';
import type {MaterialDesignIconsIconName} from '@react-native-vector-icons/material-design-icons';
import ModalSheet, {type ModalSheetHandle} from './ModalSheet';
import {Z_INDEX} from '../constants/zIndex';

export interface MenuOption {
  icon: MaterialDesignIconsIconName;
  label: string;
  onPress: () => void;
}

export interface MenuSheetHandle {
  open: () => void;
  close: () => void;
}

export interface MenuSheetProps {
  /** Any order — sorted internally, largest opens by default. */
  snapFractions?: number[];
  backgroundColor?: string;
  options: MenuOption[];
}

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

const MenuSheet = forwardRef<MenuSheetHandle, MenuSheetProps>(
  ({snapFractions = [0.75, 0.5, 0.25], backgroundColor, options}, ref) => {
    const sheetRef = useRef<ModalSheetHandle>(null);
    const scrollY = useSharedValue(0);

    useImperativeHandle(ref, () => ({
      open: () => sheetRef.current?.open(),
      close: () => sheetRef.current?.close(),
    }));

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
        snapPoints={snapFractions}
        zIndex={Z_INDEX.stackedSheets}
        backgroundColor={backgroundColor}
        header={
          <View style={styles.headerRow}>
            <View style={styles.grabber} />
            <Pressable style={styles.closeBtn} hitSlop={12} onPress={() => sheetRef.current?.close()}>
              <Icon name="close" color="#fff" size={22} />
            </Pressable>
          </View>
        }>
        <GestureDetector gesture={composedGesture}>
          <View style={styles.scrollWrap}>
            <AnimatedScrollView onScroll={scrollHandler} scrollEventThrottle={16}>
              {options.map(opt => (
                <Pressable key={opt.label} style={styles.optionRow} onPress={opt.onPress}>
                  <Icon name={opt.icon} color="#fff" size={22} />
                  <Text style={styles.optionLabel}>{opt.label}</Text>
                </Pressable>
              ))}
            </AnimatedScrollView>
          </View>
        </GestureDetector>
      </ModalSheet>
    );
  },
);

export default MenuSheet;

const styles = StyleSheet.create({
  headerRow: {alignItems: 'center', paddingVertical: 10},
  grabber: {width: 36, height: 4, borderRadius: 2, backgroundColor: '#ffffff4d'},
  closeBtn: {position: 'absolute', right: 16, top: 8},
  scrollWrap: {flex: 1},
  optionRow: {flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 14, paddingHorizontal: 20},
  optionLabel: {color: '#fff', fontSize: 15},
});