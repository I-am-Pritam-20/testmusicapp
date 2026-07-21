import type {TurboModule} from 'react-native';
import {TurboModuleRegistry} from 'react-native';

export interface Spec extends TurboModule {
  /** Runs the generate_204 reachability probe right now and resolves with
   *  the result — always a fresh check, ignoring the native-side cache. */
  checkNow(): Promise<Object>;

  // Required by the New Architecture's event-emitter convention for
  // TurboModules — RN's NativeEventEmitter calls these to track whether
  // any JS listener is currently subscribed; the native side only keeps
  // its NetworkCallback registered while listenerCount > 0.
  addListener(eventName: string): void;
  removeListeners(count: number): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('NetworkReachabilityModule');
