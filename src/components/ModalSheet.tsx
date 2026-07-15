import React, {forwardRef, useImperativeHandle, useRef, useState} from 'react';
import {Animated, Pressable, StyleSheet, View, useWindowDimensions} from 'react-native';
import {
  PanGestureHandler,
  State,
  type PanGestureHandlerGestureEvent,
  type PanGestureHandlerStateChangeEvent,
} from 'react-native-gesture-handler';

export interface ModalSheetHandle {
  open: (snapIndex?: number) => void;
  close: () => void;
  snapTo: (index: number) => void;
}

export interface ModalSheetProps {
  /** Fractions of screen height (0-1), any order — sorted internally. */
  snapPoints: number[];
  /** Which sorted snap point to open at by default. Defaults to the largest. */
  initialSnapIndex?: number;
  onClose?: () => void;
  /** Rendered above `children`; this is the ONLY draggable region — drag-to-close
   *  only works here, so scrollable `children` (FlatList/ScrollView) is never
   *  fought over between the sheet's own drag and the list's own scroll. */
  header?: React.ReactNode;
  children?: React.ReactNode;
  zIndex?: number;
  backgroundColor?: string;
}

/**
 * Shared bottom-sheet primitive for secondary/stacked sheets (queue, sleep
 * timer, menu) that open ON TOP of the native full-player sheet.
 *
 * The header's drag-to-close uses react-native-gesture-handler's
 * PanGestureHandler rather than PanResponder — it composes properly with
 * a NativeViewGestureHandler-wrapped FlatList/ScrollView inside `children`
 * (see QueueSheet/MenuSheet) via `simultaneousHandlers`, which is what
 * lets "scroll to top, then keep dragging closes it" work reliably instead
 * of the two gestures fighting over touch ownership.
 *
 * Still plain RN `Animated` (JS-driven, useNativeDriver: false) rather
 * than Reanimated — these are occasional modal opens, not a
 * continuously-interactive surface, so the simpler JS-thread animation
 * model is a fine tradeoff for not adding a second gesture/animation
 * library's worklet model into the mix.
 */
const ModalSheet = forwardRef<ModalSheetHandle, ModalSheetProps>(
  ({snapPoints, initialSnapIndex, onClose, header, children, zIndex = 20, backgroundColor = '#161616'}, ref) => {
    const {height: screenHeight} = useWindowDimensions();
    const sortedFractions = [...snapPoints].sort((a, b) => a - b);
    const maxFraction = sortedFractions[sortedFractions.length - 1];
    const panelHeight = screenHeight * maxFraction;
    // translateY, relative to the panel's own box (sized to the largest
    // snap point): 0 = that largest point fully visible, panelHeight = fully hidden.
    const snapTranslations = sortedFractions.map(f => panelHeight - screenHeight * f);
    const hiddenTranslation = panelHeight;
    const defaultIndex = initialSnapIndex ?? sortedFractions.length - 1;

    const translateY = useRef(new Animated.Value(hiddenTranslation)).current;
    const currentTranslationRef = useRef(hiddenTranslation);
    const dragStartRef = useRef(hiddenTranslation);
    const [isOpen, setIsOpen] = useState(false);

    const animateTo = (target: number, onDone?: () => void) => {
      Animated.timing(translateY, {
        toValue: target,
        duration: 260,
        useNativeDriver: false,
      }).start(() => {
        currentTranslationRef.current = target;
        onDone?.();
      });
    };

    const open = (snapIndex: number = defaultIndex) => {
      setIsOpen(true);
      const clamped = Math.min(Math.max(snapIndex, 0), snapTranslations.length - 1);
      animateTo(snapTranslations[clamped]);
    };

    const close = () => {
      animateTo(hiddenTranslation, () => {
        setIsOpen(false);
        onClose?.();
      });
    };

    const snapTo = (index: number) => open(index);

    useImperativeHandle(ref, () => ({open, close, snapTo}));

    const handleHeaderGestureEvent = (event: PanGestureHandlerGestureEvent) => {
      const {translationY} = event.nativeEvent;
      const next = dragStartRef.current + translationY;
      const clamped = Math.min(Math.max(next, snapTranslations[0]), hiddenTranslation);
      translateY.setValue(clamped);
      currentTranslationRef.current = clamped;
    };

    const handleHeaderStateChange = (event: PanGestureHandlerStateChangeEvent) => {
      const {state, translationY, velocityY} = event.nativeEvent;
      if (state === State.BEGAN) {
        dragStartRef.current = currentTranslationRef.current;
        translateY.stopAnimation();
        return;
      }
      if (state === State.END || state === State.CANCELLED) {
        const finalValue = Math.min(
          Math.max(dragStartRef.current + translationY, snapTranslations[0]),
          hiddenTranslation,
        );
        const closeDistance = hiddenTranslation - snapTranslations[0];

        // Lowered thresholds (matching the native full-player sheet): a
        // quick, small flick down should close it, not require a large
        // drag distance. velocityY here is px/second.
        if (velocityY > 500 || finalValue - snapTranslations[0] > closeDistance * 0.2) {
          close();
          return;
        }

        let nearest = snapTranslations[0];
        let nearestDist = Math.abs(finalValue - nearest);
        for (const t of snapTranslations) {
          const d = Math.abs(finalValue - t);
          if (d < nearestDist) {
            nearest = t;
            nearestDist = d;
          }
        }
        animateTo(nearest);
      }
    };

    if (!isOpen) return null;

    const backdropOpacity = translateY.interpolate({
      inputRange: [snapTranslations[snapTranslations.length - 1], hiddenTranslation],
      outputRange: [0.55, 0],
      extrapolate: 'clamp',
    });

    return (
      <>
        <Pressable style={[StyleSheet.absoluteFill, {zIndex}]} onPress={close}>
          <Animated.View style={[styles.backdrop, {opacity: backdropOpacity}]} />
        </Pressable>
        <Animated.View
          style={[
            styles.panel,
            {
              height: panelHeight,
              backgroundColor,
              zIndex: zIndex + 1,
              transform: [{translateY}],
            },
          ]}>
          <PanGestureHandler
            onGestureEvent={handleHeaderGestureEvent}
            onHandlerStateChange={handleHeaderStateChange}
            activeOffsetY={[-10, 10]}
            failOffsetX={[-20, 20]}>
            <View>{header}</View>
          </PanGestureHandler>
          {children}
        </Animated.View>
      </>
    );
  },
);

export default ModalSheet;

const styles = StyleSheet.create({
  backdrop: {...StyleSheet.absoluteFillObject, backgroundColor: '#000'},
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
});
