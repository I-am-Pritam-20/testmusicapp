/**
 * TurboModule spec for playback control.
 *
 * IMPORTANT: the Android implementation (android/media-core) does NOT
 * extend the codegen-generated abstract Spec class from this file — it's
 * a plain ReactContextBaseJavaModule + TurboModule marker instead, so the
 * :media-core Gradle module has zero build-time dependency on any one
 * app's generated codegen output and can be dropped into another RN
 * project unchanged. See the comment at the top of
 * android/media-core/.../NativeMusicPlayerModule.kt for the full
 * rationale and the tradeoff (no compile-time signature checking against
 * this file on Android; iOS, if/when added, can still use codegen normally).
 *
 * Audio sources: JioSaavn (resolve the actual playable stream URL via your
 * existing JioSaavn API integration before calling setQueue/addToQueue —
 * the native side just needs a final playable URL) and local/offline files
 * (file:// or content:// URIs). Both go through the same MediaItem pipeline.
 */
import type {TurboModule} from 'react-native';
import {TurboModuleRegistry} from 'react-native';

export type TrackSourceType = 'jiosaavn' | 'local';
export type RepeatMode = 'off' | 'one' | 'all';

export interface TrackPayload {
  id: string;
  url: string; // resolved JioSaavn stream URL, or file://./content:// for local
  sourceType: TrackSourceType;
  title: string;
  artist: string;
  artworkUrl?: string;
  durationMs?: number;
}

export interface Spec extends TurboModule {
  // Queue management
  setQueue(tracks: Array<TrackPayload>, startIndex: number): void;
  addToQueue(track: TrackPayload): void;
  removeFromQueue(trackId: string): void;

  // Transport controls
  play(): void;
  pause(): void;
  resume(): void;
  stop(): void;
  seekTo(positionMs: number): void;
  skipToNext(): void;
  skipToPrevious(): void;

  // Modes
  setShuffleEnabled(enabled: boolean): void;
  setRepeatMode(mode: string): void; // RepeatMode, kept as string for codegen simplicity
  setPlaybackSpeed(speed: number): void;

  // Reserved for forwarding theme info to native chrome later; currently a no-op.
  updateTheme(themeJson: string): void;

  // One-shot state read (e.g. on screen mount, before the first event arrives)
  getCurrentState(): Promise<Object>;

  // Required by RN's NativeEventEmitter contract on Android; both are no-ops
  // in the implementation, listener bookkeeping is handled by the OS pipe.
  addListener(eventName: string): void;
  removeListeners(count: number): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('NativeMusicPlayerModule');
