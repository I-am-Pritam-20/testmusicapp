import type {TurboModule} from 'react-native';
import {TurboModuleRegistry} from 'react-native';

export interface Spec extends TurboModule {
  pickAudioFolder(): Promise<Object | null>;
  scanFolder(treeUri: string): Promise<Array<Object>>;
  releaseFolderAccess(treeUri: string): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('DeviceLibraryModule');