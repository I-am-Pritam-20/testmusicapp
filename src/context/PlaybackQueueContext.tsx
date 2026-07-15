import React, {createContext, useContext, useEffect, useRef, useState} from 'react';
import MusicPlayer, {type PlaybackStateEvent, type RepeatMode} from '../native-kit/MusicPlayer';
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

  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);

  // Restore the last session once on mount. setQueue() would normally
  // auto-play, so we immediately pause — the goal is "ready to resume
  // exactly where you left off", not "blast audio on launch".
  useEffect(() => {
    const persisted = CacheService.getPlaybackState<PersistedPlaybackState>();
    if (persisted && persisted.tracks.length > 0) {
      setTracks(persisted.tracks);
      MusicPlayer.setQueue(persisted.tracks, persisted.currentIndex);
      MusicPlayer.pause();
      if (persisted.isShuffleEnabled) MusicPlayer.setShuffleEnabled(true);
      if (persisted.repeatMode !== 'off') MusicPlayer.setRepeatMode(persisted.repeatMode);
      // Rough edge: seeking right after setQueue races the player's own
      // buffering — a fixed delay is a pragmatic v1, not a guarantee.
      // Listening for the track to actually be ready before seeking would
      // be the more robust follow-up.
      setTimeout(() => MusicPlayer.seekTo(persisted.positionMs), 300);
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

  const playQueue = (newTracks: AppTrack[], startIndex: number) => {
    setTracks(newTracks);
    MusicPlayer.setQueue(newTracks, startIndex);
  };

  const addToQueue = (track: AppTrack) => {
    setTracks(prev => [...prev, track]);
    MusicPlayer.addToQueue(track);
  };

  const currentTrack = tracks.find(t => t.id === state?.currentTrackId) ?? null;

  return (
    <PlaybackQueueContext.Provider value={{tracks, currentTrack, state, recentTrackIds, playQueue, addToQueue}}>
      {children}
    </PlaybackQueueContext.Provider>
  );
}

export function usePlaybackQueue(): PlaybackQueueContextValue {
  const ctx = useContext(PlaybackQueueContext);
  if (!ctx) throw new Error('usePlaybackQueue must be used within PlaybackQueueProvider');
  return ctx;
}
