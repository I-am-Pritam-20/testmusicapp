import React, {forwardRef, useEffect, useImperativeHandle, useMemo, useState} from 'react';
import {Keyboard, Pressable, StyleSheet, Text, TextInput, View} from 'react-native';
import NativeBottomSheet, {type NativeBottomSheetHandle} from '../native-kit/NativeBottomSheet';
import {LibraryService, type PlaylistType} from '../services/LibraryService';

export interface CreatePlaylistModalHandle {
  open: (defaultType?: PlaylistType) => void;
}

export interface CreatePlaylistModalProps {
  onCreated: (playlistId: string) => void;
}

const BASE_FRACTION = 0.42;
const EXPANDED_FRACTION = 0.6;

/**
 * Create-playlist sheet on the universal native shell — previously its
 * own one-off Pressable-backdrop overlay; now the same reusable sheet
 * every other sheet in the app uses, with the same keyboard-driven
 * height grow SleepTimerSheet uses (the name field autofocuses, so the
 * keyboard is up almost immediately). Duplicate-name detection
 * (case-insensitive, disables Create + shows a warning) and the
 * explicit online/offline type choice are unchanged.
 */
const CreatePlaylistModal = forwardRef<CreatePlaylistModalHandle, CreatePlaylistModalProps>(({onCreated}, ref) => {
  const sheetRef = React.useRef<NativeBottomSheetHandle>(null);
  const nameInputRef = React.useRef<TextInput>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<PlaylistType>('online');
  const [activeFraction, setActiveFraction] = useState(BASE_FRACTION);

  useImperativeHandle(ref, () => ({
    open: (defaultType = 'online') => {
      setName('');
      setType(defaultType);
      setActiveFraction(BASE_FRACTION);
      sheetRef.current?.expand();
      setTimeout(() => nameInputRef.current?.focus(), 150);
    },
  }));

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setActiveFraction(EXPANDED_FRACTION));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setActiveFraction(BASE_FRACTION));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const trimmedName = name.trim();
  const isDuplicate = useMemo(() => LibraryService.isDuplicatePlaylistName(trimmedName), [trimmedName]);
  const canCreate = trimmedName.length > 0 && !isDuplicate;

  const handleCreate = () => {
    if (!canCreate) return;
    const playlist = LibraryService.createPlaylist(trimmedName, type);
    Keyboard.dismiss();
    sheetRef.current?.hide();
    onCreated(playlist.id);
  };

  return (
    <NativeBottomSheet ref={sheetRef} heightFraction={activeFraction} showBackdrop style={styles.sheet}>
      <View style={styles.panel}>
        <Text style={styles.title}>New Playlist</Text>

        <TextInput
          ref={nameInputRef}
          style={styles.input}
          placeholder="Playlist name"
          placeholderTextColor="#8a8a8a"
          value={name}
          onChangeText={setName}
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
          <Pressable style={styles.cancelBtn} onPress={() => sheetRef.current?.hide()}>
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
    </NativeBottomSheet>
  );
});

export default CreatePlaylistModal;

const styles = StyleSheet.create({
  sheet: {backgroundColor: '#181818', borderTopLeftRadius: 20, borderTopRightRadius: 20},
  panel: {padding: 20},
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
  typePillActiveOnline: {backgroundColor: '#7C4DFF22', borderColor: '#7C4DFF'},
  typePillActiveOffline: {backgroundColor: '#ffffff22', borderColor: '#ffffff'},
  typePillLabel: {color: '#9a9a9a', fontSize: 13, fontWeight: '600'},
  typePillLabelActive: {color: '#fff'},
  typeHint: {color: '#6f6f6f', fontSize: 11, marginTop: 8, lineHeight: 15},
  actionsRow: {flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 24},
  cancelBtn: {paddingVertical: 10, paddingHorizontal: 16},
  cancelLabel: {color: '#9a9a9a', fontSize: 14, fontWeight: '600'},
  createBtn: {paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20, backgroundColor: '#7C4DFF'},
  createBtnDisabled: {backgroundColor: '#2a2a2a'},
  createLabel: {color: '#fff', fontSize: 14, fontWeight: '700'},
  createLabelDisabled: {color: '#6f6f6f'},
});
