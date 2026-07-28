import React, {createContext, useContext, useEffect, useRef, useState} from 'react';
import {Platform, PermissionsAndroid} from 'react-native';
import MusicPlayer, {type PlaybackStateEvent, type RepeatMode} from '../native-kit/MusicPlayer';
import WidgetBridge from '../native-kit/WidgetBridge';
import AudioFocus from '../native-kit/AudioFocus';
import {CacheService} from '../services/CacheService';
import type {AppTrack} from '../services/trackMapper';

/**
 * Central source of "what's the current queue" for the whole app —
 * replaces the old static data.ts. Any screen (Home/Search/Library) calls
 * playQueue()/addToQueue() when the user taps a song; the mini/full
 * player and queue sheet all read from here instead of a hardcoded list.
 *
 * Also owns lifetime playback-state persistence (queue, position, shuffle,
 * repeat) via CacheService, restored on next app launch, and a
 * recently-played track-id history used to seed the home feed's
 * "Recommended for You" section.
 */

interface PersistedPlaybackState {
  tracks: AppTrack[];
  currentIndex: number;
  positionMs: number;
  isShuffleEnabled: boolean;
  repeatMode: RepeatMode;
}

interface PlaybackQueueContextValue {
  tracks: AppTrack[];
  currentTrack: AppTrack | null;
  state: PlaybackStateEvent | null;
  recentTrackIds: string[];
  playQueue: (tracks: AppTrack[], startIndex: number) => void;
  addToQueue: (track: AppTrack) => void;
  /** Whether the full-player native sheet is currently expanded — set by
   *  PlayerOverlay via setFullPlayerOpen, read by RootNavigator to hide
   *  the tab bar while it's up. */
  isFullPlayerOpen: boolean;
  setFullPlayerOpen: (open: boolean) => void;
}

const PlaybackQueueContext = createContext<PlaybackQueueContextValue | null>(null);

const HISTORY_LIMIT = 30;

export function PlaybackQueueProvider({children}: {children: React.ReactNode}): React.JSX.Element {
  const [tracks, setTracks] = useState<AppTrack[]>([]);
  const tracksRef = useRef<AppTrack[]>([]);
  const [state, setState] = useState<PlaybackStateEvent | null>(null);
  const [recentTrackIds, setRecentTrackIds] = useState<string[]>([]);
  const recentTrackIdsRef = useRef<string[]>([]);
  const hydratedRef = useRef(false);
  const lastTrackIdRef = useRef<string | null>(null);
  const [isFullPlayerOpen, setFullPlayerOpen] = useState(false);

  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);

  // Restore the last session once on mount. setQueue() would normally
  // auto-play, so we immediately pause — the goal is "ready to resume
  // exactly where you left off", not "blast audio on launch". Seeking
  // has to wait until the player has actually finished loading the
  // track (status leaves 'buffering') rather than after a fixed delay —
  // a race between a guessed timeout and real buffering time, especially
  // variable for a local file vs. a cold network fetch.
  useEffect(() => {
    const persisted = CacheService.getPlaybackState<PersistedPlaybackState>();
    if (persisted && persisted.tracks.length > 0) {
      setTracks(persisted.tracks);
      MusicPlayer.setQueue(persisted.tracks, persisted.currentIndex);
      MusicPlayer.pause();
      if (persisted.isShuffleEnabled) MusicPlayer.setShuffleEnabled(true);
      if (persisted.repeatMode !== 'off') MusicPlayer.setRepeatMode(persisted.repeatMode);

      const unsubscribeReady = MusicPlayer.onPlaybackState(readyState => {
        if (readyState.status === 'buffering') return;
        MusicPlayer.seekTo(persisted.positionMs);
        unsubscribeReady();
      });

      WidgetBridge.getInitialAction().then(action => {
        if (action === 'com.testmusicapp.WIDGET_PLAY_RESUME') MusicPlayer.resume();
      });
    }
    hydratedRef.current = true;
  }, []);

  useEffect(() => {
    const unsubscribe = MusicPlayer.onPlaybackState(next => {
      setState(next);

      if (next.currentTrackId && next.currentTrackId !== lastTrackIdRef.current) {
        lastTrackIdRef.current = next.currentTrackId;
        const history = [
          next.currentTrackId,
          ...recentTrackIdsRef.current.filter(id => id !== next.currentTrackId),
        ].slice(0, HISTORY_LIMIT);
        recentTrackIdsRef.current = history;
        setRecentTrackIds(history);
      }

      if (hydratedRef.current) {
        const currentTracks = tracksRef.current;
        CacheService.setPlaybackState({
          tracks: currentTracks,
          currentIndex: currentTracks.findIndex(t => t.id === next.currentTrackId),
          positionMs: next.positionMs,
          isShuffleEnabled: next.isShuffleEnabled,
          repeatMode: next.repeatMode,
        } satisfies PersistedPlaybackState);
      }
    });
    return unsubscribe;
  }, []);

  const currentTrack = tracks.find(t => t.id === state?.currentTrackId) ?? null;

  // Push state to the home-screen widget on every change, and relay its
  // button taps back as real playback actions. Artwork is passed through
  // untouched — WidgetBridge itself drops it if it isn't in a format the
  // native side can actually decode (a remote streaming URL, notably).
  useEffect(() => {
    WidgetBridge.startListening();

    const unsubscribers = [
      WidgetBridge.subscribe('widgetPlayPause', () => {
        if (state?.isPlaying) MusicPlayer.pause();
        else MusicPlayer.resume();
      }),
      WidgetBridge.subscribe('widgetSkipNext', () => MusicPlayer.skipToNext()),
      WidgetBridge.subscribe('widgetSkipPrev', () => MusicPlayer.skipToPrevious()),
      WidgetBridge.subscribe('widgetShuffleToggle', () => {
        MusicPlayer.setShuffleEnabled(!state?.isShuffleEnabled);
      }),
      WidgetBridge.subscribe('widgetRepeatCycle', () => {
        const next: RepeatMode =
          state?.repeatMode === 'off' ? 'one' : state?.repeatMode === 'one' ? 'once' : 'off';
        MusicPlayer.setRepeatMode(next);
      }),
      WidgetBridge.subscribe('widgetRemoved', () => {
        MusicPlayer.pause();
      }),
    ];

    return () => {
      unsubscribers.forEach(unsub => unsub());
      WidgetBridge.stopListening();
    };
    // Deliberately re-subscribing on every state change so the closures
    // above always see the latest isPlaying/isShuffleEnabled/repeatMode —
    // WidgetBridge.startListening()/stopListening() are cheap no-ops when
    // already in the desired state, so this isn't as wasteful as it looks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.isPlaying, state?.isShuffleEnabled, state?.repeatMode]);

  useEffect(() => {
    if (!state) return;
    WidgetBridge.update({
      title: currentTrack?.title,
      artist: currentTrack?.artist,
      artworkPath: currentTrack?.artworkUrl,
      isPlaying: state.isPlaying,
      isShuffle: state.isShuffleEnabled,
      repeatMode: state.repeatMode === 'once' ? 'all' : (state.repeatMode as 'off' | 'one'),
      progress: state.durationMs > 0 ? state.positionMs / state.durationMs : 0,
      durationSec: Math.round(state.durationMs / 1000),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, currentTrack?.id]);

  // Notification permission — the playback notification itself depends on
  // this on Android 13+, so it's requested once here rather than only
  // when the user happens to touch a feature (device scanning) that
  // needs a permission of its own.
  useEffect(() => {
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS).catch(() => {});
    }
  }, []);

  // Audio focus — started once on mount, not tied to playback state (it
  // needs to be listening even before anything has ever played, so a
  // call from a competing app right at launch is still handled).
  useEffect(() => {
    AudioFocus.startListening();
    const unsubscribers = [
      AudioFocus.onLost(() => MusicPlayer.pause()),
      AudioFocus.onTransientLoss(() => MusicPlayer.pause()),
      AudioFocus.onGain(({resume}) => {
        if (resume) MusicPlayer.resume();
      }),
      // onDuck needs no handler at all — the native side lowers the
      // stream volume directly; there's nothing for JS to do.
    ];
    return () => {
      unsubscribers.forEach(unsub => unsub());
      AudioFocus.stopListening();
    };
  }, []);

  const playQueue = (newTracks: AppTrack[], startIndex: number) => {
    setTracks(newTracks);
    MusicPlayer.setQueue(newTracks, startIndex);
  };

  const addToQueue = (track: AppTrack) => {
    setTracks(prev => [...prev, track]);
    MusicPlayer.addToQueue(track);
  };

  return (
    <PlaybackQueueContext.Provider
      value={{tracks, currentTrack, state, recentTrackIds, playQueue, addToQueue, isFullPlayerOpen, setFullPlayerOpen}}>
      {children}
    </PlaybackQueueContext.Provider>
  );
}

export function usePlaybackQueue(): PlaybackQueueContextValue {
  const ctx = useContext(PlaybackQueueContext);
  if (!ctx) throw new Error('usePlaybackQueue must be used within PlaybackQueueProvider');
  return ctx;
}
