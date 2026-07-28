import type {TurboModule} from 'react-native';
import {TurboModuleRegistry} from 'react-native';

export interface Spec extends TurboModule {
  /** Batched MediaMetadataRetriever extraction for real filesystem paths
   *  (already resolved from any picker URI on the JS side). Returns
   *  Array<{path, title, artist, album, duration, artwork?}> — artwork
   *  is a base64 JPEG data URI, downscaled to 200x200 natively. */
  getBatchMetadata(paths: Array<string>): Promise<Array<Object>>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('DeviceLibraryModule');
