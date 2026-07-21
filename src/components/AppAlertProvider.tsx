import React, {createContext, useCallback, useContext, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {Z_INDEX} from '../constants/zIndex';

export interface AppAlertButton {
  label: string;
  style?: 'default' | 'destructive' | 'cancel';
  onPress?: () => void;
}

export interface AppAlertOptions {
  title: string;
  message?: string;
  buttons: AppAlertButton[];
}

interface AppAlertContextValue {
  showAlert: (options: AppAlertOptions) => void;
  dismissAlert: () => void;
}

const AppAlertContext = createContext<AppAlertContextValue | null>(null);

/**
 * Custom-styled replacement for the native Alert.alert — used for removal/
 * deletion confirmations and permission-request prompts, per design
 * requirement (no native Android/iOS alert chrome anywhere in the app).
 */
export function AppAlertProvider({children}: {children: React.ReactNode}): React.JSX.Element {
  const [options, setOptions] = useState<AppAlertOptions | null>(null);

  const showAlert = useCallback((opts: AppAlertOptions) => setOptions(opts), []);
  const dismissAlert = useCallback(() => setOptions(null), []);

  const handlePress = (button: AppAlertButton) => {
    dismissAlert();
    button.onPress?.();
  };

  return (
    <AppAlertContext.Provider value={{showAlert, dismissAlert}}>
      {children}
      {options && (
        <View style={[StyleSheet.absoluteFill, styles.overlay]} pointerEvents="box-none">
          <Pressable style={StyleSheet.absoluteFill} onPress={dismissAlert} />
          <View style={styles.card}>
            <Text style={styles.title}>{options.title}</Text>
            {options.message ? <Text style={styles.message}>{options.message}</Text> : null}
            <View style={styles.buttonRow}>
              {options.buttons.map(button => (
                <Pressable key={button.label} style={styles.button} onPress={() => handlePress(button)}>
                  <Text
                    style={[
                      styles.buttonText,
                      button.style === 'destructive' && styles.destructiveText,
                      button.style === 'cancel' && styles.cancelText,
                    ]}>
                    {button.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      )}
    </AppAlertContext.Provider>
  );
}

export function useAppAlert(): AppAlertContextValue {
  const ctx = useContext(AppAlertContext);
  if (!ctx) throw new Error('useAppAlert must be used within AppAlertProvider');
  return ctx;
}

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: '#000000aa',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    zIndex: Z_INDEX.overlaysTop,
  },
  card: {backgroundColor: '#1c1c1e', borderRadius: 14, padding: 20, width: '100%', maxWidth: 320},
  title: {color: '#fff', fontSize: 17, fontWeight: '700', marginBottom: 8, textAlign: 'center'},
  message: {color: '#ffffffcc', fontSize: 14, textAlign: 'center', marginBottom: 16, lineHeight: 20},
  buttonRow: {flexDirection: 'row', justifyContent: 'flex-end', gap: 20},
  button: {paddingVertical: 8, paddingHorizontal: 4},
  buttonText: {color: '#1db954', fontWeight: '600', fontSize: 15},
  destructiveText: {color: '#ff453a'},
  cancelText: {color: '#ffffffcc'},
});