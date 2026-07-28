import React, {useState} from 'react';
import {LayoutChangeEvent, Pressable, StyleSheet, Text, View} from 'react-native';
import Animated, {useAnimatedStyle, useSharedValue, withSpring} from 'react-native-reanimated';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {BottomTabBarProps} from '@react-navigation/bottom-tabs';
import {useAppearanceTokens} from '../context/AppearanceContext';
import {usePlaybackQueue} from '../context/PlaybackQueueContext';
import {Colors, Radius, Spacing} from '../theme/colors';
import {Z_INDEX} from '../constants/zIndex';

const PILL_SPRING = {damping: 18, stiffness: 220, mass: 0.7};

interface TabLayout {
  x: number;
  width: number;
}

/**
 * A floating, fully-rounded "pill" that translates and resizes to sit
 * behind whichever tab is active — the iOS-style focus-pill tab bar,
 * not React Navigation's default flat highlight. The pill's motion is
 * the whole point, so it's a real Reanimated spring (translateX + width)
 * rather than a cross-fade — matching the same smooth, physical feel as
 * the rest of the app's sheet/toast animations.
 */
export default function PillTabBar({state, descriptors, navigation}: BottomTabBarProps): React.JSX.Element | null {
  const tokens = useAppearanceTokens();
  const insets = useSafeAreaInsets();
  const {isFullPlayerOpen} = usePlaybackQueue();
  const [layouts, setLayouts] = useState<Record<number, TabLayout>>({});

  const pillX = useSharedValue(0);
  const pillWidth = useSharedValue(0);
  const hasMeasuredActive = layouts[state.index] != null;

  React.useEffect(() => {
    const active = layouts[state.index];
    if (!active) return;
    pillX.value = withSpring(active.x, PILL_SPRING);
    pillWidth.value = withSpring(active.width, PILL_SPRING);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.index, layouts[state.index]?.x, layouts[state.index]?.width]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{translateX: pillX.value}],
    width: pillWidth.value,
  }));

  const handleLayout = (index: number) => (event: LayoutChangeEvent) => {
    const {x, width} = event.nativeEvent.layout;
    setLayouts(prev => {
      const existing = prev[index];
      if (existing && existing.x === x && existing.width === width) return prev;
      return {...prev, [index]: {x, width}};
    });
  };

  if (isFullPlayerOpen) return null;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: tokens.tabNavBg,
          paddingBottom: Math.max(insets.bottom, Spacing.sm),
          zIndex: Z_INDEX.chrome,
          elevation: Z_INDEX.chrome,
        },
      ]}>
      <View style={styles.track}>
        {hasMeasuredActive && (
          <Animated.View
            renderToHardwareTextureAndroid
            style={[styles.pill, {backgroundColor: `${Colors.accent}26`}, pillStyle]}
          />
        )}
        {state.routes.map((route, index) => {
          const {options} = descriptors[route.key];
          const isFocused = state.index === index;
          const color = isFocused ? Colors.accent : tokens.textMuted;

          const onPress = () => {
            const event = navigation.emit({type: 'tabPress', target: route.key, canPreventDefault: true});
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              onLayout={handleLayout(index)}
              style={styles.tab}
              hitSlop={4}>
              {options.tabBarIcon?.({focused: isFocused, color, size: 22})}
              <Text style={[styles.label, {color}]} numberOfLines={1}>
                {String(options.title ?? route.name)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#00000000',
  },
  track: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.sm,
  },
  pill: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    borderRadius: Radius.full,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 6,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
  },
});
