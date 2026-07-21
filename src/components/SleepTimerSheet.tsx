import React, {forwardRef, useEffect, useImperativeHandle, useRef, useState} from 'react';
import {Keyboard, Pressable, StyleSheet, Text, TextInput, View} from 'react-native';
import ModalSheet, {type ModalSheetHandle} from './ModalSheet';
import MusicPlayer from '../native-kit/MusicPlayer';
import {Z_INDEX} from '../constants/zIndex';

export interface SleepTimerSheetHandle {
  open: () => void;
  close: () => void;
}

export interface SleepTimerSheetProps {
  heightFraction?: number;
  backgroundColor?: string;
}

const PRESET_MINUTES = [5, 10, 15, 25, 30, 40, 50, 60];
// Expanded snap point used while the keyboard is open — 0.3 alone doesn't
// leave room for the preset chips + custom inputs + Set/Reset once the
// keyboard is covering the bottom of the screen.
const EXPANDED_FRACTION = 0.62;

function formatRemaining(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/**
 * Countdown is driven by the native sleep timer (MusicPlayer.startSleepTimer/
 * cancelSleepTimer/onSleepTimerTick), not a JS setInterval.
 */
const SleepTimerSheet = forwardRef<SleepTimerSheetHandle, SleepTimerSheetProps>(
  ({heightFraction = 0.3, backgroundColor}, ref) => {
    const sheetRef = useRef<ModalSheetHandle>(null);
    const [selectedPresetIndex, setSelectedPresetIndex] = useState<number | null>(null);
    const [customHours, setCustomHours] = useState('0');
    const [customMinutes, setCustomMinutes] = useState('0');
    const [customSeconds, setCustomSeconds] = useState('0');
    const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);

    useImperativeHandle(ref, () => ({
      open: () => sheetRef.current?.open(0),
      close: () => sheetRef.current?.close(),
    }));

    useEffect(() => {
      const unsubscribe = MusicPlayer.onSleepTimerTick(setRemainingSeconds);
      return unsubscribe;
    }, []);

    // Auto-expand to the larger snap point while a text field is focused,
    // and shrink back once the keyboard closes.
    useEffect(() => {
      const showSub = Keyboard.addListener('keyboardDidShow', () => sheetRef.current?.snapTo(1));
      const hideSub = Keyboard.addListener('keyboardDidHide', () => sheetRef.current?.snapTo(0));
      return () => {
        showSub.remove();
        hideSub.remove();
      };
    }, []);

    const handleSet = () => {
      Keyboard.dismiss();
      if (selectedPresetIndex != null) {
        MusicPlayer.startSleepTimer(PRESET_MINUTES[selectedPresetIndex] * 60);
        return;
      }
      const h = parseInt(customHours, 10) || 0;
      const m = parseInt(customMinutes, 10) || 0;
      const s = parseInt(customSeconds, 10) || 0;
      MusicPlayer.startSleepTimer(h * 3600 + m * 60 + s);
    };

    const handleReset = () => {
      Keyboard.dismiss();
      MusicPlayer.cancelSleepTimer();
      setSelectedPresetIndex(null);
      setCustomHours('0');
      setCustomMinutes('0');
      setCustomSeconds('0');
    };

    return (
      <ModalSheet
        ref={sheetRef}
        snapPoints={[heightFraction, EXPANDED_FRACTION]}
        zIndex={Z_INDEX.stackedSheets}
        backgroundColor={backgroundColor}
        // No FlatList here, so the whole surface (not just a header strip)
        // can safely be the draggable zone.
        header={
          <View style={styles.body}>
            <View style={styles.headerRow}>
              <Text style={styles.headerTitle}>Sleep Timer</Text>
              <Pressable hitSlop={12} onPress={() => sheetRef.current?.close()}>
                <Text style={styles.closeX}>✕</Text>
              </Pressable>
            </View>

            {remainingSeconds != null ? (
              <Text style={styles.remaining}>{formatRemaining(remainingSeconds)} remaining</Text>
            ) : (
              <Text style={styles.remainingIdle}>No timer set</Text>
            )}

            <View style={styles.presetTrack}>
              {PRESET_MINUTES.map((minutes, index) => (
                <Pressable
                  key={minutes}
                  style={[styles.presetChip, selectedPresetIndex === index && styles.presetChipActive]}
                  onPress={() => setSelectedPresetIndex(index)}>
                  <Text style={[styles.presetLabel, selectedPresetIndex === index && styles.presetLabelActive]}>
                    {minutes}m
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.customRow}>
              <View style={styles.customField}>
                <TextInput
                  style={styles.customInput}
                  keyboardType="number-pad"
                  value={customHours}
                  onChangeText={v => {
                    setSelectedPresetIndex(null);
                    setCustomHours(v.replace(/[^0-9]/g, ''));
                  }}
                />
                <Text style={styles.customLabel}>hr</Text>
              </View>
              <View style={styles.customField}>
                <TextInput
                  style={styles.customInput}
                  keyboardType="number-pad"
                  value={customMinutes}
                  onChangeText={v => {
                    setSelectedPresetIndex(null);
                    setCustomMinutes(v.replace(/[^0-9]/g, ''));
                  }}
                />
                <Text style={styles.customLabel}>min</Text>
              </View>
              <View style={styles.customField}>
                <TextInput
                  style={styles.customInput}
                  keyboardType="number-pad"
                  value={customSeconds}
                  onChangeText={v => {
                    setSelectedPresetIndex(null);
                    setCustomSeconds(v.replace(/[^0-9]/g, ''));
                  }}
                />
                <Text style={styles.customLabel}>sec</Text>
              </View>
            </View>

            <View style={styles.actionsRow}>
              <Pressable style={styles.resetBtn} onPress={handleReset}>
                <Text style={styles.resetBtnText}>Reset</Text>
              </Pressable>
              <Pressable style={styles.setBtn} onPress={handleSet}>
                <Text style={styles.setBtnText}>Set</Text>
              </Pressable>
            </View>
          </View>
        }
      />
    );
  },
);

export default SleepTimerSheet;

const styles = StyleSheet.create({
  body: {paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24},
  headerRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16},
  headerTitle: {color: '#fff', fontSize: 16, fontWeight: '700'},
  closeX: {color: '#fff', fontSize: 18},
  remaining: {color: '#1db954', fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 16},
  remainingIdle: {color: '#ffffff80', fontSize: 14, textAlign: 'center', marginBottom: 16},
  presetTrack: {flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 20},
  presetChip: {paddingVertical: 8, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1, borderColor: '#ffffff4d'},
  presetChipActive: {backgroundColor: '#1db954', borderColor: '#1db954'},
  presetLabel: {color: '#ffffffb3'},
  presetLabelActive: {color: '#000', fontWeight: '700'},
  customRow: {flexDirection: 'row', justifyContent: 'center', gap: 16, marginBottom: 20},
  customField: {alignItems: 'center'},
  customInput: {
    color: '#fff',
    fontSize: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#ffffff4d',
    width: 48,
    textAlign: 'center',
    paddingVertical: 4,
  },
  customLabel: {color: '#ffffff80', fontSize: 11, marginTop: 4},
  actionsRow: {flexDirection: 'row', gap: 12},
  resetBtn: {flex: 1, paddingVertical: 12, borderRadius: 24, borderWidth: 1, borderColor: '#ffffff4d', alignItems: 'center'},
  resetBtnText: {color: '#fff', fontWeight: '600'},
  setBtn: {flex: 1, paddingVertical: 12, borderRadius: 24, backgroundColor: '#1db954', alignItems: 'center'},
  setBtnText: {color: '#000', fontWeight: '700'},
});