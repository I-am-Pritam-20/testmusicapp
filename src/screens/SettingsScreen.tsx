import React, {useState} from 'react';
import {Alert, Pressable, ScrollView, StyleSheet, Text, TextInput} from 'react-native';
import {configureMusicApiBaseUrl, getMusicApiBaseUrl} from '../services/musicApi';
import {CacheService} from '../services/CacheService';

export default function SettingsScreen(): React.JSX.Element {
  const [baseUrl, setBaseUrl] = useState(getMusicApiBaseUrl());

  const handleSaveBaseUrl = () => {
    configureMusicApiBaseUrl(baseUrl);
    Alert.alert('Saved', 'API base URL updated for this session.');
  };

  const handleClearHomeFeedOnly = () => {
    CacheService.invalidateHomeFeed();
    Alert.alert('Done', 'Home feed cache cleared — it will refresh next time you open Home.');
  };

  const handleClearAll = () => {
    Alert.alert(
      'Clear all cached data',
      "This clears the home feed cache, playback state, AND your library (playlists, liked songs, downloads registry). This can't be undone.",
      [
        {text: 'Cancel', style: 'cancel'},
        {text: 'Clear everything', style: 'destructive', onPress: () => CacheService.clearAll()},
      ],
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>Settings</Text>

      {/* <Text style={styles.sectionLabel}>API Base URL</Text>
      <TextInput
        style={styles.input}
        value={baseUrl}
        onChangeText={setBaseUrl}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Pressable style={styles.button} onPress={handleSaveBaseUrl}>
        <Text style={styles.buttonText}>Save</Text>
      </Pressable> */}

      <Text style={styles.sectionLabel}>Cache</Text>
      <Pressable style={styles.rowButton} onPress={handleClearHomeFeedOnly}>
        <Text style={styles.rowButtonText}>Refresh home feed cache</Text>
      </Pressable>
      <Pressable style={styles.rowButton} onPress={handleClearAll}>
        <Text style={[styles.rowButtonText, styles.destructiveText]}>Clear all cached data</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#000'},
  content: {padding: 16, paddingBottom: 140},
  header: {color: '#fff', fontSize: 24, fontWeight: '700', marginBottom: 24},
  sectionLabel: {color: '#ffffffb3', fontSize: 13, marginTop: 20, marginBottom: 8, textTransform: 'uppercase'},
  input: {backgroundColor: '#1a1a1a', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: '#fff'},
  button: {marginTop: 10, backgroundColor: '#1db954', borderRadius: 20, paddingVertical: 10, alignItems: 'center'},
  buttonText: {color: '#000', fontWeight: '700'},
  rowButton: {paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#ffffff22'},
  rowButtonText: {color: '#fff'},
  destructiveText: {color: '#ff453a'},
});
