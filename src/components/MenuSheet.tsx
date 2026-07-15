import React, {forwardRef, useImperativeHandle, useRef} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {
  NativeViewGestureHandler,
  PanGestureHandler,
  State,
  type PanGestureHandlerGestureEvent,
  type PanGestureHandlerStateChangeEvent,
} from 'react-native-gesture-handler';
import Icon from '@react-native-vector-icons/material-design-icons';
import ModalSheet, {type ModalSheetHandle} from './ModalSheet';

export interface MenuOption {
  icon: string;
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
  options: MenuOption[];
}

const MenuSheet = forwardRef<MenuSheetHandle, MenuSheetProps>(
  ({snapFractions = [0.75, 0.5, 0.25], options}, ref) => {
    const sheetRef = useRef<ModalSheetHandle>(null);
    const scrollYRef = useRef(0);
    const nativeGestureRef = useRef(null);
    const panGestureRef = useRef(null);

    useImperativeHandle(ref, () => ({
      open: () => sheetRef.current?.open(),
      close: () => sheetRef.current?.close(),
    }));

    const handleScrollPanEvent = (_event: PanGestureHandlerGestureEvent) => {};

    const handleScrollPanStateChange = (event: PanGestureHandlerStateChangeEvent) => {
      const {state, translationY} = event.nativeEvent;
      if (state === State.END && scrollYRef.current <= 0 && translationY > 60) {
        sheetRef.current?.close();
      }
    };

    return (
      <ModalSheet
        ref={sheetRef}
        snapPoints={snapFractions}
        zIndex={30}
        header={
          <View style={styles.headerRow}>
            <View style={styles.grabber} />
            <Pressable style={styles.closeBtn} hitSlop={12} onPress={() => sheetRef.current?.close()}>
              <Icon name="close" color="#fff" size={22} />
            </Pressable>
          </View>
        }>
        <PanGestureHandler
          ref={panGestureRef}
          simultaneousHandlers={nativeGestureRef}
          onGestureEvent={handleScrollPanEvent}
          onHandlerStateChange={handleScrollPanStateChange}
          activeOffsetY={10}
          failOffsetX={[-20, 20]}>
          <View style={styles.scrollWrap}>
            <NativeViewGestureHandler ref={nativeGestureRef} simultaneousHandlers={panGestureRef}>
              <ScrollView
                onScroll={e => {
                  scrollYRef.current = e.nativeEvent.contentOffset.y;
                }}
                scrollEventThrottle={16}>
                {options.map(opt => (
                  <Pressable key={opt.label} style={styles.optionRow} onPress={opt.onPress}>
                    <Icon name={opt.icon} color="#fff" size={22} />
                    <Text style={styles.optionLabel}>{opt.label}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </NativeViewGestureHandler>
          </View>
        </PanGestureHandler>
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
