import {CacheService} from './CacheService';
import DeviceLibrary, {type DeviceAudioFile, type DeviceFolder} from '../native-kit/DeviceLibrary';
import {LibraryService} from './LibraryService';
import type {AppTrack} from './trackMapper';

export type TrackedFolder = DeviceFolder;

const FOLDERS_KEY = 'device_folders';
const DEVICE_FILES_KEY = 'device_files';

/**
 * No default/enforced folder — the app only ever knows about folders the
 * user explicitly picked via pickAndAddFolder(). Scanning is manual
 * (scanAllFolders(), wired to a "Scan" button), never automatic.
 */
export const DeviceLibraryService = {
  getFolders(): TrackedFolder[] {
    return CacheService.getLibraryItem<TrackedFolder[]>(FOLDERS_KEY) ?? [];
  },

  getFiles(): DeviceAudioFile[] {
    return CacheService.getLibraryItem<DeviceAudioFile[]>(DEVICE_FILES_KEY) ?? [];
  },

  /** Shared DeviceAudioFile → AppTrack mapping so every screen that can
   *  play a device-scanned file (offline homescreen, search, DeviceSongsScreen)
   *  builds the exact same shape. */
  toAppTrack(file: DeviceAudioFile): AppTrack {
    return {
      id: file.id,
      url: file.url,
      sourceType: 'local',
      title: file.title,
      artist: file.artist,
      artworkUrl: file.thumbnailUri ?? undefined,
      durationMs: file.durationMs,
    };
  },

  /** Returns null if the user cancelled the picker, or the folder was
   *  already tracked. */
  async pickAndAddFolder(): Promise<TrackedFolder | null> {
    const folder = await DeviceLibrary.pickFolder();
    if (!folder) return null;
    const folders = DeviceLibraryService.getFolders();
    if (folders.some(f => f.uri === folder.uri)) return null;
    CacheService.setLibraryItem(FOLDERS_KEY, [...folders, folder]);
    return folder;
  },

  /** Scans every tracked folder and APPENDS newly-found files (by id) to
   *  the existing registry — never replaces it, so files found in a
   *  previous scan aren't lost if a folder becomes temporarily unreadable. */
  async scanAllFolders(): Promise<DeviceAudioFile[]> {
    const folders = DeviceLibraryService.getFolders();
    const existing = DeviceLibraryService.getFiles();
    const existingIds = new Set(existing.map(f => f.id));
    const appended: DeviceAudioFile[] = [];

    for (const folder of folders) {
      const found = await DeviceLibrary.scanFolder(folder.uri);
      for (const file of found) {
        if (!existingIds.has(file.id)) {
          appended.push(file);
          existingIds.add(file.id);
        }
      }
    }

    const merged = [...existing, ...appended];
    CacheService.setLibraryItem(DEVICE_FILES_KEY, merged);
    return merged;
  },

  /** Removing a folder releases its persisted permission, drops its files
   *  from the registry, AND prunes them from any offline playlists that
   *  reference them — a playlist shouldn't silently keep references to
   *  files the app can no longer access. */
  removeFolder(folderUri: string): void {
    DeviceLibrary.releaseFolderAccess(folderUri);

    CacheService.setLibraryItem(
      FOLDERS_KEY,
      DeviceLibraryService.getFolders().filter(f => f.uri !== folderUri),
    );

    const removedIds = new Set(
      DeviceLibraryService.getFiles()
        .filter(f => f.folderUri === folderUri)
        .map(f => f.id),
    );
    CacheService.setLibraryItem(
      DEVICE_FILES_KEY,
      DeviceLibraryService.getFiles().filter(f => !removedIds.has(f.id)),
    );

    for (const playlist of LibraryService.getPlaylists()) {
      if (playlist.type !== 'offline') continue;
      for (const track of playlist.tracks) {
        if (removedIds.has(track.id)) {
          LibraryService.removeTrackFromPlaylist(playlist.id, track.id);
        }
      }
    }
  },
};