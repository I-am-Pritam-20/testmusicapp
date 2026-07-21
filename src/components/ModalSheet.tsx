import React, {forwardRef, useImperativeHandle, useState} from 'react';
import {Pressable, StyleSheet, View, useWindowDimensions} from 'react-native';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import Animated, {Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming} from 'react-native-reanimated';
import {Z_INDEX} from '../constants/zIndex';

export interface ModalSheetHandle {
  open: (snapIndex?: number) => void;
  close: () => void;
  snapTo: (index: number) => void;
}

export interface ModalSheetProps {
  snapPoints: number[];
  initialSnapIndex?: number;
  onClose?: () => void;
  header?: React.ReactNode;
  children?: React.ReactNode;
  zIndex?: number;
  backgroundColor?: string;
}

const ANIMATION_DURATION = 260;
const EASING = Easing.out(Easing.cubic);

const ModalSheet = forwardRef<ModalSheetHandle, ModalSheetProps>(
  ({snapPoints, initialSnapIndex, onClose, header, children, zIndex = Z_INDEX.stackedSheets, backgroundColor = '#161616'}, ref) => {
    const {height: screenHeight} = useWindowDimensions();
    const sortedFractions = [...snapPoints].sort((a, b) => a - b);
    const maxFraction = sortedFractions[sortedFractions.length - 1];
    const panelHeight = screenHeight * maxFraction;
    // translateY, relative to the panel's own box (sized to the largest
    // snap point): 0 = that largest point fully visible, panelHeight = fully hidden.
    const snapTranslations = sortedFractions.map(f => panelHeight - screenHeight * f);
    const hiddenTranslation = panelHeight;
    const defaultIndex = initialSnapIndex ?? sortedFractions.length - 1;
    const closeDistance = hiddenTranslation - snapTranslations[0];

    const translateY = useSharedValue(hiddenTranslation);
    const dragStartY = useSharedValue(hiddenTranslation);
    const [isOpen, setIsOpen] = useState(false);

    const finishClose = () => {
      setIsOpen(false);
      onClose?.();
    };

    const animateTo = (target: number, isClosing = false) => {
      'worklet';
      translateY.value = withTiming(target, {duration: ANIMATION_DURATION, easing: EASING}, finished => {
        if (finished && isClosing) runOnJS(finishClose)();
      });
    };

    const open = (snapIndex: number = defaultIndex) => {
      setIsOpen(true);
      const clamped = Math.min(Math.max(snapIndex, 0), snapTranslations.length - 1);
      translateY.value = hiddenTranslation;
      requestAnimationFrame(() => animateTo(snapTranslations[clamped]));
    };

    const close = () => animateTo(hiddenTranslation, true);

    const snapTo = (index: number) => animateTo(snapTranslations[Math.min(Math.max(index, 0), snapTranslations.length - 1)]);

    useImperativeHandle(ref, () => ({open, close, snapTo}));

    const panGesture = Gesture.Pan()
      .onStart(() => {
        dragStartY.value = translateY.value;
      })
      .onUpdate(event => {
        const next = dragStartY.value + event.translationY;
        translateY.value = Math.min(Math.max(next, snapTranslations[0]), hiddenTranslation);
      })
      .onEnd(event => {
        const finalValue = translateY.value;
        // Lowered thresholds (matching the native full-player sheet): a
        // quick, small flick down should close it, not require a large
        // drag distance.
        if (event.velocityY > 500 || finalValue - snapTranslations[0] > closeDistance * 0.2) {
          animateTo(hiddenTranslation, true);
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
        translateY.value = withTiming(nearest, {duration: ANIMATION_DURATION, easing: EASING});
      })
      .activeOffsetY([-10, 10])
      .failOffsetX([-20, 20]);

    const panelStyle = useAnimatedStyle(() => ({
      transform: [{translateY: translateY.value}],
    }));

    const backdropStyle = useAnimatedStyle(() => {
      const max = snapTranslations[snapTranslations.length - 1];
      const range = hiddenTranslation - max || 1;
      const progress = Math.max(0, Math.min(1, 1 - (translateY.value - max) / range));
      return {opacity: progress * 0.55};
    });

    if (!isOpen) return null;

    return (
      <>
        <Pressable style={[StyleSheet.absoluteFill, {zIndex}]} onPress={close}>
          <Animated.View style={[styles.backdrop, backdropStyle]} />
        </Pressable>
        <Animated.View
          renderToHardwareTextureAndroid
          style={[styles.panel, {height: panelHeight, backgroundColor, zIndex: zIndex + 1}, panelStyle]}>
          <GestureDetector gesture={panGesture}>
            <View>{header}</View>
          </GestureDetector>
          {children}
        </Animated.View>
      </>
    );
  },
);

export default ModalSheet;

const styles = StyleSheet.create({
  backdrop: {...StyleSheet.absoluteFill, backgroundColor: '#000'},
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    // Deliberately no overflow:'hidden' here — combined with borderRadius
    // on an Animated.View that also carries a live `transform`, that forces
    // the GPU to rebuild a clipped, rounded, animating surface every frame
    // and is what caused the original Android RenderThread SIGSEGV crashes.
    // Content (header + children) is padded well within these bounds so it
    // doesn't visibly bleed past the rounded corners without clipping.
    elevation: 16,
  },
});