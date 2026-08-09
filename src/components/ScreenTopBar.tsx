import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Icon from '@react-native-vector-icons/material-design-icons';
import {useAppearanceTokens} from '../context/AppearanceContext';
import {Z_INDEX} from '../constants/zIndex';

export interface ScreenTopBarProps {
  title: string;
  right?: React.ReactNode;
}

/**
 * Every screen owns its own top bar now instead of relying on React
 * Navigation's built-in stack header (which the Stack.Navigator no
 * longer renders at all — see RootNavigator's headerShown:false) — this
 * is the one shared implementation so they all match.
 */
export default function ScreenTopBar({title, right}: ScreenTopBarProps): React.JSX.Element {
  const navigation = useNavigation();
  const tokens = useAppearanceTokens();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, {backgroundColor: tokens.topBarBg, paddingTop: insets.top, zIndex: Z_INDEX.chrome}]}>
      <View style={styles.row}>
        <Pressable hitSlop={12} onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="chevron-left" size={26} color={tokens.textPrimary} />
        </Pressable>
        <Text style={[styles.title, {color: tokens.textPrimary}]} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.right}>{right}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {shadowColor: '#000', shadowOpacity: 0.15, shadowOffset: {width: 0, height: 2}, shadowRadius: 4, elevation: 4},
  row: {flexDirection: 'row', alignItems: 'center', height: 48, paddingHorizontal: 4},
  backBtn: {padding: 8},
  title: {flex: 1, fontSize: 17, fontWeight: '700'},
  right: {minWidth: 8, flexDirection: 'row', alignItems: 'center'},
});
