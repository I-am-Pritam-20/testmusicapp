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