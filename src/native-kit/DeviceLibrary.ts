import RNFS from 'react-native-fs';
import {pickDirectory} from '@react-native-documents/picker';
import NativeDeviceLibraryModule from './specs/NativeDeviceLibraryModule';

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

// Broader than inotuneoffline's original list per this app's "any format"
// requirement — MIME sniffing isn't available once we're walking plain
// paths via RNFS, so this whitelist is the only signal.
const AUDIO_EXTENSIONS = new Set([
  'mp3', 'm4a', 'aac', 'flac', 'wav', 'wave', 'ogg', 'oga', 'opus',
  'wma', 'aiff', 'aif', 'alac', 'ape', 'amr', 'mid', 'midi', '3gp',
  '3ga', 'mka', 'dsf', 'dff',
]);

function isAudioFile(name: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return AUDIO_EXTENSIONS.has(ext);
}

/**
 * Converts a SAF tree/document URI to a real filesystem path so it can be
 * walked with react-native-fs directly — RNFS's own content:// URI
 * support doesn't reliably handle directory listing, so this sidesteps
 * that entirely rather than fighting it. Ported from inotuneoffline's
 * FileScanner.ts; only handles the standard "primary" storage volume,
 * same caveat that version carried (an SD card with a different volume
 * id wouldn't resolve here).
 */
function resolveToFsPath(uri: string): string | null {
  if (uri.startsWith('/')) return uri;
  if (uri.startsWith('file://')) return decodeURIComponent(uri.replace('file://', ''));
  if (uri.includes('externalstorage.documents')) {
    try {
      const decoded = decodeURIComponent(uri);
      const match = decoded.match(/primary[:%3A]+(.*)$/i);
      if (match) {
        const rel = match[1].split('/document/')[0].replace(/^primary:/i, '');
        return rel ? `/storage/emulated/0/${rel}` : '/storage/emulated/0';
      }
    } catch {
      // fall through to null below
    }
  }
  return null;
}

/** Fast directory walk collecting only paths — no metadata yet. Skips
 *  hidden folders and Android's own restricted /Android data directory
 *  (recursing into it just throws permission errors on modern Android). */
async function collectAudioPaths(dir: string, out: string[]): Promise<void> {
  try {
    if (!(await RNFS.exists(dir))) return;
    const items = await RNFS.readDir(dir);
    for (const item of items) {
      if (item.isDirectory()) {
        if (!item.name.startsWith('.') && item.name !== 'Android') {
          await collectAudioPaths(item.path, out);
        }
      } else if (item.isFile() && !item.name.startsWith('.') && isAudioFile(item.name)) {
        out.push(item.path);
      }
    }
  } catch {
    // Unreadable directory (permission edge case) — skip it, don't fail the whole scan.
  }
}

const METADATA_BATCH_SIZE = 50;

class DeviceLibrary {
  /** Resolves null if the user cancels the picker — not an error.
   *  requestLongTermAccess:true (unlike inotuneoffline's original
   *  false) so a previously-picked folder keeps working after the app
   *  is fully closed and reopened, not just for the current session. */
  async pickFolder(): Promise<DeviceFolder | null> {
    const result = await pickDirectory({requestLongTermAccess: true});
    if (!result) return null;
    const name = result.uri.split('/').filter(Boolean).pop() ?? 'Folder';
    return {uri: result.uri, name: decodeURIComponent(name)};
  }

  /** Walks the folder (via a resolved real path) and enriches every
   *  audio file found with native, batched metadata extraction. */
  async scanFolder(folderUri: string): Promise<DeviceAudioFile[]> {
    const fsPath = resolveToFsPath(folderUri);
    if (!fsPath) return [];

    const paths: string[] = [];
    await collectAudioPaths(fsPath, paths);
    const unique = Array.from(new Set(paths));
    if (unique.length === 0) return [];

    const files: DeviceAudioFile[] = [];
    for (let i = 0; i < unique.length; i += METADATA_BATCH_SIZE) {
      const chunk = unique.slice(i, i + METADATA_BATCH_SIZE);
      try {
        const results = (await NativeDeviceLibraryModule.getBatchMetadata(chunk)) as Array<{
          path: string;
          title?: string;
          artist?: string;
          duration?: number;
          artwork?: string | null;
        }>;
        for (const r of results) {
          const filename = r.path.split('/').pop() ?? r.path;
          files.push({
            id: `device-${r.path}`,
            url: `file://${r.path}`,
            title: r.title || filename.replace(/\.[^/.]+$/, ''),
            artist: r.artist || 'Unknown Artist',
            durationMs: r.duration ?? 0,
            folderUri,
            thumbnailUri: r.artwork ?? null,
          });
        }
      } catch {
        // This batch's native call failed outright — still list the
        // files by filename rather than dropping them from the scan.
        for (const p of chunk) {
          const filename = p.split('/').pop() ?? p;
          files.push({
            id: `device-${p}`,
            url: `file://${p}`,
            title: filename.replace(/\.[^/.]+$/, ''),
            artist: 'Unknown Artist',
            durationMs: 0,
            folderUri,
            thumbnailUri: null,
          });
        }
      }
    }
    return files;
  }

  /** No-op now that picking uses requestLongTermAccess — kept so
   *  DeviceLibraryService's existing call site doesn't need to change.
   *  react-native-documents/picker manages the persisted grant itself;
   *  there's nothing left for this app to explicitly release. */
  releaseFolderAccess(_treeUri: string): void {}
}

export default new DeviceLibrary();
