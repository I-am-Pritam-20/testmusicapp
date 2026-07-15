import React, {forwardRef, useCallback, useImperativeHandle, useRef} from 'react';
import {findNodeHandle, StyleSheet, UIManager, type ViewStyle} from 'react-native';
import NativeBottomSheetView from './specs/NativeBottomSheetViewNativeComponent';
import type {SheetState} from './specs/NativeBottomSheetViewNativeComponent';

export interface NativeBottomSheetHandle {
  expand: () => void;
  collapse: () => void;
  hide: () => void;
}

export interface NativeBottomSheetProps {
  initialState?: 'hidden' | 'expanded';
  onStateChange?: (state: SheetState) => void;
  style?: ViewStyle;
  children?: React.ReactNode;
}

/**
 * JS wrapper for the native NativeBottomSheetView. This is a pure
 * translateY slide with no gesture recognition and no opacity animation —
 * open/close only happen via expand()/hide(), driven by JS (e.g. tapping
 * the mini player). "collapse" is kept as an alias for "hide" so existing
 * call sites (onCollapse-style naming) don't need renaming.
 */
const NativeBottomSheet = forwardRef<NativeBottomSheetHandle, NativeBottomSheetProps>(
  ({initialState = 'hidden', onStateChange, style, children}, ref) => {
    const nativeRef = useRef<React.ElementRef<typeof NativeBottomSheetView>>(null);

    const dispatch = useCallback((command: string, args: ReadonlyArray<unknown> = []) => {
      const node = findNodeHandle(nativeRef.current);
      if (node == null) return;
      UIManager.dispatchViewManagerCommand(node, command, args as unknown[]);
    }, []);

    useImperativeHandle(ref, () => ({
      expand: () => dispatch('expand'),
      collapse: () => dispatch('collapse'),
      hide: () => dispatch('hide'),
    }));

    return (
      <NativeBottomSheetView
        ref={nativeRef}
        style={[StyleSheet.absoluteFill, style]}
        initialState={initialState}
        onSheetStateChange={e => onStateChange?.(e.nativeEvent.state as SheetState)}>
        {children}
      </NativeBottomSheetView>
    );
  },
);

export default NativeBottomSheet;
