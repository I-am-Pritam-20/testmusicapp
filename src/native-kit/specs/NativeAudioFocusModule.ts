import type {TurboModule} from 'react-native';
import {TurboModuleRegistry} from 'react-native';

export interface Spec extends TurboModule {
  /** Requests audio focus and starts listening for focus changes — call
   *  once the player is ready. Safe to call repeatedly, no-op if already
   *  listening. */
  startListening(): void;
  stopListening(): void;

  addListener(eventName: string): void;
  removeListeners(count: number): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('AudioFocusModule');
