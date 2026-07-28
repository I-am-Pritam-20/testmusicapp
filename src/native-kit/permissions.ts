import {PermissionsAndroid, Platform} from 'react-native';

export async function ensureAudioPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  if (Platform.Version < 29) return true; // pre-scoped-storage, no runtime grant needed

  const permission =
    Platform.Version >= 33
      ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO
      : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;

  const granted = await PermissionsAndroid.request(permission, {
    title: 'Music library access',
    message: 'Need to access and play songs stored in this device.',
    buttonPositive: 'Allow',
    buttonNegative: 'Deny',
  });
  return granted === PermissionsAndroid.RESULTS.GRANTED;
}