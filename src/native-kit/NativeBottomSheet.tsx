import React, {forwardRef, useCallback, useImperativeHandle, useRef} from 'react';
import {findNodeHandle, Pressable, StyleSheet, UIManager, type StyleProp, type ViewStyle} from 'react-native';
import Animated, {useAnimatedStyle, useSharedValue, withTiming} from 'react-native-reanimated';
import NativeBottomSheetView from './specs/NativeBottomSheetViewNativeComponent';
import type {SheetState} from './specs/NativeBottomSheetViewNativeComponent';

export interface NativeBottomSheetHandle {
  expand: () => void;
  collapse: () => void;
  hide: () => void;
  /** For sheets with their own scrollable content (the queue list) —
   *  disable the native drag-to-close while that content isn't
   *  scrolled to the top, so the two gestures don't fight each other. */
  setDismissGestureEnabled: (enabled: boolean) => void;
}

export interface NativeBottomSheetProps {
  initialState?: 'hidden' | 'expanded';
  onStateChange?: (state: SheetState) => void;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  /** 0.1-1, defaults to 1 (full screen, the original full-player-only
   *  behavior). Less than 1 leaves the rest of the screen showing
   *  through as backdrop — for Queue, Sleep Timer, the context menu, and
   *  Create Playlist, all of which now share this one native view rather
   *  than each having their own JS-side sheet implementation. */
  heightFraction?: number;
  /** Renders a tap-to-dismiss scrim behind the sheet, fading in/out with
   *  its state. Opacity-only animation (no transform, no borderRadius,
   *  no overflow) — safe under this app's crash-prevention rules. Skip
   *  for full-screen sheets (the full player), which don't need one. */
  showBackdrop?: boolean;
}

/**
 * JS wrapper for the native NativeBottomSheetView — one implementation
 * reused for every sheet in the app. The sheet's own slide is a pure
 * native translateY with a built-in drag-to-close gesture, no JS
 * animation involved at all; the only thing this wrapper adds on the JS
 * side is an optional backdrop, and that's opacity-only. "collapse" is
 * kept as an alias for "hide" so existing call sites (onCollapse-style
 * naming) don't need renaming.
 */
const NativeBottomSheet = forwardRef<NativeBottomSheetHandle, NativeBottomSheetProps>(
  ({initialState = 'hidden', onStateChange, style, children, heightFraction = 1, showBackdrop = false}, ref) => {
    const nativeRef = useRef<React.ElementRef<typeof NativeBottomSheetView>>(null);
    const backdropOpacity = useSharedValue(initialState === 'expanded' ? 1 : 0);

    const dispatch = useCallback((command: string, args: ReadonlyArray<unknown> = []) => {
      const node = findNodeHandle(nativeRef.current);
      if (node == null) return;
      UIManager.dispatchViewManagerCommand(node, command, args as unknown[]);
    }, []);

    useImperativeHandle(ref, () => ({
      expand: () => dispatch('expand'),
      collapse: () => dispatch('collapse'),
      hide: () => dispatch('hide'),
      setDismissGestureEnabled: (enabled: boolean) => dispatch('setDismissGestureEnabled', [enabled]),
    }));

    const handleStateChange = useCallback(
      (state: SheetState) => {
        if (showBackdrop) backdropOpacity.value = withTiming(state === 'expanded' ? 1 : 0, {duration: 250});
        onStateChange?.(state);
      },
      [showBackdrop, backdropOpacity, onStateChange],
    );

    const backdropStyle = useAnimatedStyle(() => ({opacity: backdropOpacity.value}));

    return (
      <>
        {showBackdrop && (
          <Pressable style={StyleSheet.absoluteFill} onPress={() => dispatch('hide')} pointerEvents="box-none">
            <Animated.View style={[styles.backdrop, backdropStyle]} pointerEvents="none" />
          </Pressable>
        )}
        <NativeBottomSheetView
          ref={nativeRef}
          style={[StyleSheet.absoluteFill, style]}
          initialState={initialState}
          expandedHeightFraction={heightFraction}
          onSheetStateChange={e => handleStateChange(e.nativeEvent.state as SheetState)}>
          {children}
        </NativeBottomSheetView>
      </>
    );
  },
);

export default NativeBottomSheet;

const styles = StyleSheet.create({
  backdrop: {...StyleSheet.absoluteFill, backgroundColor: '#000000cc'},
});
