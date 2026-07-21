import React, {forwardRef, useImperativeHandle, useMemo, useState} from 'react';
import {KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View} from 'react-native';
import {Z_INDEX} from '../constants/zIndex';
import {LibraryService, type PlaylistType} from '../services/LibraryService';

export interface CreatePlaylistModalHandle {
  open: (defaultType?: PlaylistType) => void;
}

export interface CreatePlaylistModalProps {
  onCreated: (playlistId: string) => void;
}

/**
 * Custom modal (no native Alert/prompt) with keyboard handling, duplicate-
 * name detection (case-insensitive, disables Create + shows a red
 * warning), and an explicit online/offline type choice — a playlist can
 * only ever hold one or the other, never both.
 */
const CreatePlaylistModal = forwardRef<CreatePlaylistModalHandle, CreatePlaylistModalProps>(({onCreated}, ref) => {
  const [visible, setVisible] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<PlaylistType>('online');

  useImperativeHandle(ref, () => ({
    open: (defaultType = 'online') => {
      setName('');
      setType(defaultType);
      setVisible(true);
    },
  }));

  const trimmedName = name.trim();
  const isDuplicate = useMemo(() => LibraryService.isDuplicatePlaylistName(trimmedName), [trimmedName]);
  const canCreate = trimmedName.length > 0 && !isDuplicate;

  const handleCreate = () => {
    if (!canCreate) return;
    const playlist = LibraryService.createPlaylist(trimmedName, type);
    setVisible(false);
    onCreated(playlist.id);
  };

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Pressable
        style={[StyleSheet.absoluteFill, styles.backdrop, {zIndex: Z_INDEX.overlaysTop}]}
        onPress={() => setVisible(false)}
      />
      <KeyboardAvoidingView
        style={[styles.centerWrap, {zIndex: Z_INDEX.overlaysTop + 1}]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        pointerEvents="box-none">
        <View style={styles.panel}>
          <Text style={styles.title}>New Playlist</Text>

          <TextInput
            style={styles.input}
            placeholder="Playlist name"
            placeholderTextColor="#8a8a8a"
            value={name}
            onChangeText={setName}
            autoFocus
            maxLength={60}
          />
          {isDuplicate && trimmedName.length > 0 && (
            <Text style={styles.warning}>A playlist named "{trimmedName}" already exists.</Text>
          )}

          <Text style={styles.sectionLabel}>Type</Text>
          <View style={styles.typeRow}>
            <Pressable
              style={[styles.typePill, type === 'online' && styles.typePillActiveOnline]}
              onPress={() => setType('online')}>
              <Text style={[styles.typePillLabel, type === 'online' && styles.typePillLabelActive]}>Online</Text>
            </Pressable>
            <Pressable
              style={[styles.typePill, type === 'offline' && styles.typePillActiveOffline]}
              onPress={() => setType('offline')}>
              <Text style={[styles.typePillLabel, type === 'offline' && styles.typePillLabelActive]}>Offline</Text>
            </Pressable>
          </View>
          <Text style={styles.typeHint}>
            {type === 'online'
              ? 'Holds streamed songs. Only shows up while you\u2019re online.'
              : 'Holds downloaded / on-device songs. Always available.'}
          </Text>

          <View style={styles.actionsRow}>
            <Pressable style={styles.cancelBtn} onPress={() => setVisible(false)}>
              <Text style={styles.cancelLabel}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.createBtn, !canCreate && styles.createBtnDisabled]}
              disabled={!canCreate}
              onPress={handleCreate}>
              <Text style={[styles.createLabel, !canCreate && styles.createLabelDisabled]}>Create</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
});

export default CreatePlaylistModal;

const styles = StyleSheet.create({
  backdrop: {backgroundColor: 'rgba(0,0,0,0.6)'},
  centerWrap: {flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24},
  panel: {width: '100%', maxWidth: 400, backgroundColor: '#181818', borderRadius: 16, padding: 20},
  title: {color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 16},
  input: {backgroundColor: '#262626', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: '#fff', fontSize: 15},
  warning: {color: '#ff6b6b', fontSize: 12, marginTop: 8},
  sectionLabel: {
    color: '#9a9a9a',
    fontSize: 12,
    marginTop: 18,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  typeRow: {flexDirection: 'row', gap: 10},
  typePill: {flex: 1, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: '#3a3a3a', alignItems: 'center'},
  typePillActiveOnline: {backgroundColor: '#1db95422', borderColor: '#1db954'},
  typePillActiveOffline: {backgroundColor: '#ffffff22', borderColor: '#ffffff'},
  typePillLabel: {color: '#9a9a9a', fontSize: 13, fontWeight: '600'},
  typePillLabelActive: {color: '#fff'},
  typeHint: {color: '#6f6f6f', fontSize: 11, marginTop: 8, lineHeight: 15},
  actionsRow: {flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 24},
  cancelBtn: {paddingVertical: 10, paddingHorizontal: 16},
  cancelLabel: {color: '#9a9a9a', fontSize: 14, fontWeight: '600'},
  createBtn: {paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20, backgroundColor: '#1db954'},
  createBtnDisabled: {backgroundColor: '#2a2a2a'},
  createLabel: {color: '#04120a', fontSize: 14, fontWeight: '700'},
  createLabelDisabled: {color: '#6f6f6f'},
});
