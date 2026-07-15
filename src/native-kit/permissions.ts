import {PermissionsAndroid, Platform} from 'react-native';

export async function ensureAudioPermission(): Promise<boolean> {
  if (Platform.OS !== 'android' || Platform.Version < 33) return true;
  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO,
    {
      title: 'Music library access',
      message: 'Need to access and play songs stored in this device.',
      buttonPositive: 'Allow',
      buttonNegative: 'Deny',
    },
  );
  return granted === PermissionsAndroid.RESULTS.GRANTED;
}