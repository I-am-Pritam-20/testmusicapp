import {NativeEventEmitter} from 'react-native';
import NativeNetworkReachabilityModule from './specs/NetworkReachabilityModule';

export type ConnectivityStatus = 'online' | 'offline';

export interface ConnectivityResult {
  /** 'online' only when the real HTTP probe succeeded — not just "has a
   *  network interface". */
  status: ConnectivityStatus;
  /** True when the device has *some* network transport (wifi/cellular),
   *  even if that transport turned out not to have real internet behind
   *  it (captive portal, dead router). Lets the UI distinguish "no wifi
   *  at all" from "on wifi, but it's not actually working". */
  hasTransport: boolean;
}

/**
 * Thin wrapper around NetworkReachabilityModule — the native side does
 * the actual generate_204 HTTP probe and NetworkCallback registration
 * (see netinfo_checker.md for the rationale); this just gives JS a
 * typed, promise/event based API over it.
 */
class NetworkReachability {
  private emitter = new NativeEventEmitter(NativeNetworkReachabilityModule as never);

  /** One-shot, always-fresh check. Use for the app-launch decision and
   *  for a manual "Go Online" retry tap. */
  async checkNow(): Promise<ConnectivityResult> {
    return (await NativeNetworkReachabilityModule.checkNow()) as ConnectivityResult;
  }

  /** Fires whenever the native NetworkCallback observes a transport
   *  change, debounced/cached natively to at most once per ~10s for an
   *  unforced re-check. Returns an unsubscribe function. */
  subscribe(listener: (result: ConnectivityResult) => void): () => void {
    const subscription = this.emitter.addListener('onConnectivityChanged', listener);
    return () => subscription.remove();
  }
}

export default new NetworkReachability();
