/**
 * JS-friendly wrapper around the NativeMusicPlayerModule TurboModule.
 * App/screen code should import this, not specs/NativeMusicPlayerModule
 * directly.
 */
import {NativeEventEmitter} from 'react-native';
import NativeMusicPlayerModule from './specs/NativeMusicPlayerModule';
import type {RepeatMode, TrackPayload} from './specs/NativeMusicPlayerModule';

export type {RepeatMode, TrackPayload};

const emitter = new NativeEventEmitter(NativeMusicPlayerModule as any);

export type PlaybackStatus =
  | 'idle'
  | 'buffering'
  | 'playing'
  | 'paused'
  | 'stopped'
  | 'error';

export interface PlaybackStateEvent {
  status: PlaybackStatus;
  /** Reflects user intent (native playWhenReady) — stays true through a
   *  seek-induced buffer, only false when the user explicitly paused/
   *  stopped. Use this for the play/pause button, not `status`, which can
   *  read "buffering" even while the user still means to be playing. */
  isPlaying: boolean;
  positionMs: number;
  durationMs: number;
  currentTrackId: string | null;
  isShuffleEnabled: boolean;
  repeatMode: RepeatMode;
  speed: number;
}

export interface QueueChangedEvent {
  queue: Array<Pick<TrackPayload, 'id' | 'title' | 'artist' | 'artworkUrl'>>;
  currentIndex: number;
}

export interface PlayerErrorEvent {
  code: string;
  message: string;
}

export interface DeviceAudioFile {
  id: string;
  url: string;
  title: string;
  artist: string;
  album: string | null;
  durationMs: number;
}

class MusicPlayer {
  setQueue(tracks: TrackPayload[], startIndex = 0): void {
    NativeMusicPlayerModule.setQueue(tracks, startIndex);
  }

  addToQueue(track: TrackPayload): void {
    NativeMusicPlayerModule.addToQueue(track);
  }

  removeFromQueue(trackId: string): void {
    NativeMusicPlayerModule.removeFromQueue(trackId);
  }

  play(): void {
    NativeMusicPlayerModule.play();
  }

  pause(): void {
    NativeMusicPlayerModule.pause();
  }

  resume(): void {
    NativeMusicPlayerModule.resume();
  }

  stop(): void {
    NativeMusicPlayerModule.stop();
  }

  seekTo(positionMs: number): void {
    NativeMusicPlayerModule.seekTo(positionMs);
  }

  skipToNext(): void {
    NativeMusicPlayerModule.skipToNext();
  }

  skipToPrevious(): void {
    NativeMusicPlayerModule.skipToPrevious();
  }

  setShuffleEnabled(enabled: boolean): void {
    NativeMusicPlayerModule.setShuffleEnabled(enabled);
  }

  setRepeatMode(mode: RepeatMode): void {
    NativeMusicPlayerModule.setRepeatMode(mode);
  }

  setPlaybackSpeed(speed: number): void {
    NativeMusicPlayerModule.setPlaybackSpeed(speed);
  }

  updateTheme(theme: Record<string, unknown>): void {
    NativeMusicPlayerModule.updateTheme(JSON.stringify(theme));
  }

  getCurrentState(): Promise<PlaybackStateEvent> {
    return NativeMusicPlayerModule.getCurrentState() as Promise<PlaybackStateEvent>;
  }

  onPlaybackState(callback: (event: PlaybackStateEvent) => void): () => void {
    const sub = emitter.addListener('onPlaybackState', callback);
    return () => sub.remove();
  }

  onQueueChanged(callback: (event: QueueChangedEvent) => void): () => void {
    const sub = emitter.addListener('onQueueChanged', callback);
    return () => sub.remove();
  }

  onError(callback: (event: PlayerErrorEvent) => void): () => void {
    const sub = emitter.addListener('onError', callback);
    return () => sub.remove();
  }

  startSleepTimer(seconds: number): void {
    NativeMusicPlayerModule.startSleepTimer(seconds);
  }

  cancelSleepTimer(): void {
    NativeMusicPlayerModule.cancelSleepTimer();
  }

  /** `remainingSeconds` is null once the timer is cancelled or finishes. */
  onSleepTimerTick(callback: (remainingSeconds: number | null) => void): () => void {
    const sub = emitter.addListener('onSleepTimerTick', (event: {remainingSeconds: number | null}) =>
      callback(event.remainingSeconds),
    );
    return () => sub.remove();
  }

  scanDeviceAudio(): Promise<DeviceAudioFile[]> {
    return NativeMusicPlayerModule.scanDeviceAudio() as Promise<DeviceAudioFile[]>;
  }

  downloadTrack(url: string, fileName: string): Promise<string> {
    return NativeMusicPlayerModule.downloadTrack(url, fileName);
  }

  deleteDownloadedFile(localPath: string): Promise<boolean> {
    return NativeMusicPlayerModule.deleteDownloadedFile(localPath);
  }
}

export default new MusicPlayer();