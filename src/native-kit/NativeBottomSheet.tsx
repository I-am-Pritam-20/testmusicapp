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
  collapsedHeight: number;
  initialState?: 'collapsed' | 'expanded' | 'hidden';
  onStateChange?: (state: SheetState) => void;
  onSlide?: (progress: number) => void;
  style?: ViewStyle;
  children?: React.ReactNode;
}

/**
 * JS wrapper for the native NativeBottomSheetView. The sheet's vertical
 * drag/snap/animation is 100% native — this component only forwards RN
 * children to render inside it and exposes a small imperative API plus two
 * event callbacks (onStateChange, onSlide) so RN can crossfade its own
 * mini/full player content in response.
 */
const NativeBottomSheet = forwardRef<NativeBottomSheetHandle, NativeBottomSheetProps>(
  ({collapsedHeight, initialState = 'collapsed', onStateChange, onSlide, style, children}, ref) => {
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
        collapsedHeight={collapsedHeight}
        initialState={initialState}
        onSheetStateChange={e => onStateChange?.(e.nativeEvent.state as SheetState)}
        onSlide={e => onSlide?.(e.nativeEvent.progress)}>
        {children}
      </NativeBottomSheetView>
    );
  },
);

export default NativeBottomSheet;
