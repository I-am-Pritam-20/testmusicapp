import React, {createContext, useCallback, useContext, useEffect, useRef, useState} from 'react';
import NetworkReachability, {type ConnectivityResult} from '../native-kit/NetworkReachability';
import {useAppToast} from './AppToastProvider';

const NETWORK_TOAST_ID = 'network-status';

export type ConnectivityStatus = 'online' | 'offline' | 'checking';

interface NetworkStatusContextValue {
  /** The real, current connectivity state from the native reachability
   *  check (generate_204 probe + NetworkCallback) — not the raw
   *  device-has-a-network-interface flag. 'checking' only during the
   *  very first probe right after app launch. */
  status: ConnectivityStatus;
  /** What the UI should actually render right now. Usually mirrors
   *  `status`, except right after the user taps "Cancel" on the
   *  reconnect toast — then this stays 'offline' (so they aren't yanked
   *  out of whatever they were doing) until they tap "Go Online". */
  viewMode: 'online' | 'offline';
  /** Forces a fresh native check right now — for pull-to-refresh-style
   *  manual retry affordances. */
  recheck: () => void;
  /** Switches viewMode to 'online' immediately, without waiting for the
   *  toast — used by any "try going online" button outside the toast. */
  goOnline: () => void;
}

const NetworkStatusContext = createContext<NetworkStatusContextValue | null>(null);

export function useNetworkStatus(): NetworkStatusContextValue {
  const ctx = useContext(NetworkStatusContext);
  if (!ctx) throw new Error('useNetworkStatus must be used within NetworkStatusProvider');
  return ctx;
}

export interface NetworkStatusProviderProps {
  children: React.ReactNode;
}

/**
 * Single source of truth for online/offline state, backed by the native
 * NetworkReachabilityModule (generate_204 probe + NetworkCallback — see
 * netinfo_checker.md) rather than a raw NetInfo isConnected flag, so a
 * wifi-with-no-internet captive portal is correctly treated as offline.
 *
 * Reconnect UX: silent on the very first resolution at launch (the
 * offline homescreen itself communicates that state — no need for a
 * toast on top of it). After that, a real online→offline drop mid-session
 * shows a brief "You're offline" toast and forces viewMode to 'offline';
 * a real offline→online recovery shows "You're back online" with "Go
 * Online" / "Cancel" and only switches viewMode if the user taps "Go
 * Online" — tapping "Cancel" (or letting it time out) leaves them where
 * they were.
 */
export function NetworkStatusProvider({children}: NetworkStatusProviderProps): React.JSX.Element {
  const {showToast, hideToast} = useAppToast();
  const [status, setStatus] = useState<ConnectivityStatus>('checking');
  const [viewMode, setViewMode] = useState<'online' | 'offline'>('offline');
  const hasResolvedOnceRef = useRef(false);

  const applyResult = useCallback(
    (result: ConnectivityResult) => {
      const isFirstResolution = !hasResolvedOnceRef.current;
      hasResolvedOnceRef.current = true;

      setStatus(prevStatus => {
        if (result.status === 'offline') {
          setViewMode('offline');
          if (!isFirstResolution && prevStatus === 'online') {
            showToast({id: NETWORK_TOAST_ID, message: "You're offline", durationMs: 3000});
          }
          return 'offline';
        }

        // result.status === 'online'
        if (isFirstResolution) {
          setViewMode('online');
        } else if (prevStatus === 'offline') {
          showToast({
            id: NETWORK_TOAST_ID,
            message: "You're back online",
            actionLabel: 'Go Online',
            secondaryActionLabel: 'Cancel',
            durationMs: 8000,
            onAction: () => setViewMode('online'),
            onSecondaryAction: () => hideToast(NETWORK_TOAST_ID),
          });
        }
        return 'online';
      });
    },
    [showToast, hideToast],
  );

  useEffect(() => {
    NetworkReachability.checkNow().then(applyResult);
    const unsubscribe = NetworkReachability.subscribe(applyResult);
    return unsubscribe;
    // Deliberately only on mount — applyResult closes over the latest
    // showToast/hideToast via the useCallback dep array above, so this
    // doesn't need to re-subscribe when those identities change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const recheck = useCallback(() => {
    setStatus('checking');
    NetworkReachability.checkNow().then(applyResult);
  }, [applyResult]);

  const goOnline = useCallback(() => {
    hideToast(NETWORK_TOAST_ID);
    setViewMode('online');
  }, [hideToast]);

  return (
    <NetworkStatusContext.Provider value={{status, viewMode, recheck, goOnline}}>
      {children}
    </NetworkStatusContext.Provider>
  );
}
