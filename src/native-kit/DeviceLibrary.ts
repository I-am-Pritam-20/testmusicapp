import NativeDeviceLibraryModule from './specs/DeviceLibraryModule';

export interface DeviceFolder {
  uri: string;
  name: string;
}

export interface DeviceAudioFile {
  id: string;
  url: string;
  title: string;
  artist: string;
  durationMs: number;
  folderUri: string;
  thumbnailUri: string | null;
}

class DeviceLibrary {
  /** Resolves null if the user cancels the picker — not an error. */
  async pickFolder(): Promise<DeviceFolder | null> {
    return (await NativeDeviceLibraryModule.pickAudioFolder()) as DeviceFolder | null;
  }

  async scanFolder(treeUri: string): Promise<DeviceAudioFile[]> {
    return (await NativeDeviceLibraryModule.scanFolder(treeUri)) as DeviceAudioFile[];
  }

  releaseFolderAccess(treeUri: string): void {
    NativeDeviceLibraryModule.releaseFolderAccess(treeUri);
  }
}

export default new DeviceLibrary();