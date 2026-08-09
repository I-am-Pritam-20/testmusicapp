import {NativeEventEmitter} from 'react-native';
import NativeAudioFocusModule from './specs/NativeAudioFocusModule';

/**
 * Thin wrapper around AudioFocusModule (ported from inotuneoffline) — the
 * native side distinguishes a permanent focus loss (another music app took
 * over — pause, don't auto-resume) from a transient one (a phone call —
 * pause, auto-resume on gain) from a duckable one (a notification sound —
 * lower volume natively, no pause needed at all).
 */
class AudioFocus {
  private emitter = new NativeEventEmitter(NativeAudioFocusModule as never);
  private listening = false;

  startListening(): void {
    if (this.listening) return;
    this.listening = true;
    NativeAudioFocusModule.startListening();
  }

  stopListening(): void {
    if (!this.listening) return;
    this.listening = false;
    NativeAudioFocusModule.stopListening();
  }

  onLost(listener: () => void): () => void {
    const sub = this.emitter.addListener('audioFocusLost', listener);
    return () => sub.remove();
  }

  onTransientLoss(listener: () => void): () => void {
    const sub = this.emitter.addListener('audioFocusTransient', listener);
    return () => sub.remove();
  }

  onDuck(listener: () => void): () => void {
    const sub = this.emitter.addListener('audioFocusDuck', listener);
    return () => sub.remove();
  }

  onGain(listener: (params: {resume: boolean}) => void): () => void {
    const sub = this.emitter.addListener('audioFocusGain', listener);
    return () => sub.remove();
  }
}

export default new AudioFocus();
