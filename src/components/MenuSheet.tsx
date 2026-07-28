import React, {forwardRef, useImperativeHandle, useRef} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import Icon from '@react-native-vector-icons/material-design-icons';
import type {MaterialDesignIconsIconName} from '@react-native-vector-icons/material-design-icons';
import NativeBottomSheet, {type NativeBottomSheetHandle} from '../native-kit/NativeBottomSheet';

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
  /** Only the first (largest) value is used as the sheet's fixed height
   *  — kept as an array for call-site compatibility, since nothing here
   *  actually switches between them dynamically the way Sleep Timer's
   *  keyboard-driven resize does. */
  snapFractions?: number[];
  backgroundColor?: string;
  options: MenuOption[];
}

/**
 * Generic context-menu sheet on the universal native shell. A short
 * options list rarely needs its own internal scroll, but ScrollView is
 * kept (rather than assuming it always fits) — the native sheet's
 * drag-to-close only activates on a clear vertical swipe well past touch
 * slop, which in practice doesn't fight a plain ScrollView the way a
 * long, actively-scrolled FlatList (QueueSheet) can.
 */
const MenuSheet = forwardRef<MenuSheetHandle, MenuSheetProps>(
  ({snapFractions = [0.5], backgroundColor, options}, ref) => {
    const sheetRef = useRef<NativeBottomSheetHandle>(null);
    const heightFraction = snapFractions[0] ?? 0.5;

    useImperativeHandle(ref, () => ({
      open: () => sheetRef.current?.expand(),
      close: () => sheetRef.current?.hide(),
    }));

    return (
      <NativeBottomSheet
        ref={sheetRef}
        heightFraction={heightFraction}
        showBackdrop
        style={[styles.sheet, backgroundColor ? {backgroundColor} : null]}>
        <View style={styles.headerRow}>
          <View style={styles.grabber} />
          <Pressable style={styles.closeBtn} hitSlop={12} onPress={() => sheetRef.current?.hide()}>
            <Icon name="close" color="#fff" size={22} />
          </Pressable>
        </View>
        <ScrollView style={styles.scrollWrap}>
          {options.map(opt => (
            <Pressable key={opt.label} style={styles.optionRow} onPress={opt.onPress}>
              <Icon name={opt.icon} color="#fff" size={22} />
              <Text style={styles.optionLabel}>{opt.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </NativeBottomSheet>
    );
  },
);

export default MenuSheet;

const styles = StyleSheet.create({
  sheet: {backgroundColor: '#181818', borderTopLeftRadius: 20, borderTopRightRadius: 20},
  headerRow: {alignItems: 'center', paddingVertical: 10},
  grabber: {width: 36, height: 4, borderRadius: 2, backgroundColor: '#ffffff4d'},
  closeBtn: {position: 'absolute', right: 16, top: 8},
  scrollWrap: {flex: 1},
  optionRow: {flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 14, paddingHorizontal: 20},
  optionLabel: {color: '#fff', fontSize: 15},
});
