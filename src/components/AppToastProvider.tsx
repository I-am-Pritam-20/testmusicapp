import React, {createContext, useCallback, useContext, useRef, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import Animated, {useAnimatedStyle, useSharedValue, withTiming} from 'react-native-reanimated';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Z_INDEX} from '../constants/zIndex';
import {useAppearanceTokens} from '../context/AppearanceContext';

export interface ToastOptions {
  /** Toasts sharing an id replace each other (e.g. network status) rather
   *  than stacking — most recent wins. Omit for one-off toasts. */
  id?: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  /** A second, visually secondary action (e.g. "Cancel" alongside "Go
   *  Online") — rendered to the left of the primary action, in a muted
   *  color so it doesn't compete with it. Optional; most toasts only
   *  need the one primary action. */
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  /** Auto-dismiss after this many ms. Omit for a persistent toast. */
  durationMs?: number;
}

interface ToastContextValue {
  showToast: (options: ToastOptions) => void;
  hideToast: (id?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_ID = '__default__';

/**
 * Custom toast system (no native platform toast/snackbar) — one visible
 * toast at a time. Covers: "press back again to exit", "Added to
 * playlist", "You're offline" / "You're back online" with "Go Online" /
 * "Cancel" actions.
 */
export function AppToastProvider({children}: {children: React.ReactNode}): React.JSX.Element {
  const [current, setCurrent] = useState<(ToastOptions & {id: string}) | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const translateY = useSharedValue(100);
  const insets = useSafeAreaInsets();
  const tokens = useAppearanceTokens();

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const hideToast = useCallback(
    (id?: string) => {
      setCurrent(prev => {
        if (id && prev?.id !== id) return prev; // a different toast owns the slot now
        translateY.value = withTiming(100, {duration: 200});
        return null;
      });
    },
    [translateY],
  );

  const showToast = useCallback(
    (options: ToastOptions) => {
      clearTimer();
      const withId = {...options, id: options.id ?? DEFAULT_ID};
      setCurrent(withId);
      translateY.value = withTiming(0, {duration: 220});
      if (options.durationMs) {
        timerRef.current = setTimeout(() => hideToast(withId.id), options.durationMs);
      }
    },
    [hideToast, translateY],
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{translateY: translateY.value}],
  }));

  return (
    <ToastContext.Provider value={{showToast, hideToast}}>
      {children}
      {current && (
        <Animated.View
          renderToHardwareTextureAndroid
          style={[styles.toast, {bottom: 24 + insets.bottom, backgroundColor: tokens.sheetBg}, animatedStyle]}>
          <Text style={[styles.message, {color: tokens.textPrimary}]} numberOfLines={2}>
            {current.message}
          </Text>
          <View style={styles.actions}>
            {current.secondaryActionLabel && (
              <Pressable
                hitSlop={8}
                onPress={() => {
                  current.onSecondaryAction?.();
                  hideToast(current.id);
                }}>
                <Text style={[styles.secondaryAction, {color: tokens.textMuted}]}>{current.secondaryActionLabel}</Text>
              </Pressable>
            )}
            {current.actionLabel && (
              <Pressable
                hitSlop={8}
                onPress={() => {
                  current.onAction?.();
                  hideToast(current.id);
                }}>
                <Text style={[styles.action, {color: tokens.accent}]}>{current.actionLabel}</Text>
              </Pressable>
            )}
          </View>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

export function useAppToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useAppToast must be used within AppToastProvider');
  return ctx;
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: '#1c1c1e',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    zIndex: Z_INDEX.overlaysTop,
    // Deliberately NOT tied to Z_INDEX.overlaysTop (150) — `elevation`
    // triggers Android's shadow rasterization pipeline and is a
    // different concern from RN's paint-order zIndex; extreme values
    // here overwhelm it (see the crash-prevention notes this app
    // inherited — elevation must stay in the 12-20 range).
    elevation: 16,
  },
  message: {color: '#fff', flex: 1, fontSize: 14},
  actions: {flexDirection: 'row', alignItems: 'center', gap: 16},
  action: {color: '#1db954', fontWeight: '700', fontSize: 14},
  secondaryAction: {color: '#9a9a9a', fontWeight: '600', fontSize: 14},
});
