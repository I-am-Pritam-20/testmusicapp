import type {TurboModule} from 'react-native';
import {TurboModuleRegistry} from 'react-native';

export type TrackSourceType = 'jiosaavn' | 'local';
export type RepeatMode = 'off' | 'one' | 'once';

export interface TrackPayload {
  id: string;
  url: string;
  sourceType: TrackSourceType;
  title: string;
  artist: string;
  artworkUrl?: string;
  durationMs?: number;
  bgColor?: string;
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