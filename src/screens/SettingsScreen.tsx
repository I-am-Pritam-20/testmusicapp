import React from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import Icon from '@react-native-vector-icons/material-design-icons';
import type {MaterialDesignIconsIconName} from '@react-native-vector-icons/material-design-icons';
import {CacheService} from '../services/CacheService';
import {useAppearance, type AppearanceMode} from '../context/AppearanceContext';
import {useAppAlert} from '../components/AppAlertProvider';
import {Colors} from '../theme/colors';

const APPEARANCE_OPTIONS: Array<{mode: AppearanceMode; label: string; description: string; icon: MaterialDesignIconsIconName}> = [
  {mode: 'default', label: 'Default', description: 'The original teal/black look', icon: 'star-four-points-outline'},
  {mode: 'light', label: 'Light', description: 'Plain light grey, solid', icon: 'white-balance-sunny'},
  {mode: 'dark', label: 'Dark', description: 'Plain dark grey, solid', icon: 'moon-waning-crescent'},
  {mode: 'device', label: 'Match Device', description: 'Follows your system light/dark setting', icon: 'cellphone'},
  {mode: 'lightGradient', label: 'Light Gradient', description: 'Light grey fading to a deeper grey', icon: 'gradient-horizontal'},
  {mode: 'darkGradient', label: 'Dark Gradient', description: 'Dark grey fading to black', icon: 'gradient-vertical'},
  {mode: 'colored', label: 'Colored', description: "Solid background from the current song's artwork", icon: 'palette'},
  {mode: 'coloredGradient', label: 'Colored Gradient', description: 'Artwork color fading to a darker shade of itself', icon: 'palette-swatch'},
  {mode: 'coloredGradientDark', label: 'Color → Dark', description: 'Artwork color fading all the way to black', icon: 'weather-night'},
  {mode: 'imageBlur', label: 'Image Blur', description: 'The artwork itself, blurred, behind a dark overlay', icon: 'blur'},
];

export default function SettingsScreen(): React.JSX.Element {
  const {mode, tokens, setMode} = useAppearance();
  const {showAlert} = useAppAlert();

  const handleClearHomeFeedOnly = () => {
    CacheService.invalidateHomeFeed();
    showAlert({
      title: 'Done',
      message: 'Home feed cache cleared — it will refresh next time you open Home.',
      buttons: [{label: 'OK', style: 'default'}],
    });
  };

  const handleClearAll = () => {
    showAlert({
      title: 'Clear all cached data',
      message:
        "This clears the home feed cache, playback state, AND your library (playlists, liked songs, downloads registry). This can't be undone.",
      buttons: [
        {label: 'Cancel', style: 'cancel'},
        {label: 'Clear everything', style: 'destructive', onPress: () => CacheService.clearAll()},
      ],
    });
  };

  return (
    <ScrollView
      style={[styles.container, {backgroundColor: tokens.bg}]}
      contentContainerStyle={styles.content}>
      <Text style={[styles.header, {color: tokens.textPrimary}]}>Settings</Text>

      <Text style={[styles.sectionLabel, {color: tokens.textSecondary}]}>App Appearance</Text>
      <Text style={[styles.sectionSubtitle, {color: tokens.textMuted}]}>
        Changes the background immediately — pick whichever looks best to you.
      </Text>
      <View style={styles.chipGrid}>
        {APPEARANCE_OPTIONS.map(option => {
          const active = mode === option.mode;
          return (
            <Pressable
              key={option.mode}
              style={[
                styles.chip,
                {borderColor: active ? Colors.accent : tokens.border, backgroundColor: active ? `${Colors.accent}22` : tokens.cardBg},
              ]}
              onPress={() => setMode(option.mode)}>
              <Icon name={option.icon} size={20} color={active ? Colors.accent : tokens.textSecondary} />
              <Text style={[styles.chipLabel, {color: active ? Colors.accent : tokens.textPrimary}]}>{option.label}</Text>
              <Text style={[styles.chipDescription, {color: tokens.textMuted}]} numberOfLines={2}>
                {option.description}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.sectionLabel, {color: tokens.textSecondary}]}>Cache</Text>
      <Pressable style={[styles.rowButton, {borderBottomColor: tokens.divider}]} onPress={handleClearHomeFeedOnly}>
        <Text style={[styles.rowButtonText, {color: tokens.textPrimary}]}>Refresh home feed cache</Text>
      </Pressable>
      <Pressable style={[styles.rowButton, {borderBottomColor: tokens.divider}]} onPress={handleClearAll}>
        <Text style={[styles.rowButtonText, styles.destructiveText]}>Clear all cached data</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1},
  content: {padding: 16, paddingBottom: 140},
  header: {fontSize: 24, fontWeight: '700', marginBottom: 24},
  sectionLabel: {fontSize: 13, marginTop: 20, marginBottom: 4, textTransform: 'uppercase'},
  sectionSubtitle: {fontSize: 12, marginBottom: 12},
  chipGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 10},
  chip: {
    width: '47%',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 4,
  },
  chipLabel: {fontSize: 14, fontWeight: '700'},
  chipDescription: {fontSize: 11, lineHeight: 14},
  rowButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowButtonText: {fontSize: 15},
  destructiveText: {color: '#ff453a'},
});
