import React, {createContext, useContext, useEffect, useMemo, useRef, useState} from 'react';
import {colorExtractor} from '../services/colorExtractor';
import {CacheService} from '../services/CacheService';
import {usePlaybackQueue} from './PlaybackQueueContext';

/**
 * Ten appearance modes, carried over from inotuneoffline's AppearanceContext:
 * two static palettes (light/dark), an AMOLED true-black variant, two
 * gradient variants of those, four modes whose colors are derived live
 * from the currently playing song's artwork, and the original
 * teal/black "Default" look. Fixed hex values below match the ones on
 * record for modes 1/2/4/5/10; the artwork-derived modes are computed
 * at runtime via colorExtractor rather than hardcoded, since by
 * definition they change with whatever's playing.
 */
export type AppearanceMode =
  | 'light'
  | 'dark'
  | 'amoled'
  | 'lightGradient'
  | 'darkGradient'
  | 'dominantVibrant'
  | 'dominantMuted'
  | 'dominantLight'
  | 'dominantDark'
  | 'default';

export const APPEARANCE_MODES: Array<{key: AppearanceMode; label: string}> = [
  {key: 'default', label: 'Default'},
  {key: 'light', label: 'Light'},
  {key: 'dark', label: 'Dark'},
  {key: 'amoled', label: 'AMOLED'},
  {key: 'lightGradient', label: 'Light Gradient'},
  {key: 'darkGradient', label: 'Dark Gradient'},
  {key: 'dominantVibrant', label: 'Artwork — Vibrant'},
  {key: 'dominantMuted', label: 'Artwork — Muted'},
  {key: 'dominantLight', label: 'Artwork — Light'},
  {key: 'dominantDark', label: 'Artwork — Dark'},
];

export interface AppearanceTokens {
  mode: AppearanceMode;
  topBarBg: string;
  sheetBg: string;
  cardBg: string;
  tabNavBg: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  fadeColor: string;
  accent: string;
  gradientColors?: [string, string];
  isDark: boolean;
}

const STORAGE_KEY = 'appearance_mode';
const ACCENT = '#1db954';

const DEFAULT_TOKENS: AppearanceTokens = {
  mode: 'default',
  topBarBg: '#0b3f3e',
  sheetBg: '#14201c',
  cardBg: '#111815',
  tabNavBg: '#000000',
  textPrimary: '#ffffff',
  textSecondary: '#ffffffb3',
  textMuted: '#ffffff66',
  fadeColor: '#000000',
  accent: ACCENT,
  isDark: true,
};

/** Modes with fixed, known values — resolved synchronously. */
function computeFixedTokens(mode: AppearanceMode): AppearanceTokens | null {
  switch (mode) {
    case 'default':
      return DEFAULT_TOKENS;
    case 'light':
      return {
        mode,
        topBarBg: '#ccc',
        sheetBg: '#bbb',
        cardBg: '#d0d0d0',
        tabNavBg: '#ccc',
        textPrimary: '#111111',
        textSecondary: '#333333',
        textMuted: '#666666',
        fadeColor: '#cccccc',
        accent: ACCENT,
        isDark: false,
      };
    case 'dark':
      return {
        mode,
        topBarBg: '#444444',
        sheetBg: '#333333',
        cardBg: '#333333',
        tabNavBg: '#000000',
        textPrimary: '#ffffff',
        textSecondary: '#ffffffb3',
        textMuted: '#ffffff66',
        fadeColor: '#000000',
        accent: ACCENT,
        isDark: true,
      };
    case 'amoled':
      return {
        mode,
        topBarBg: '#000000',
        sheetBg: '#000000',
        cardBg: '#0a0a0a',
        tabNavBg: '#000000',
        textPrimary: '#ffffff',
        textSecondary: '#ffffffb3',
        textMuted: '#ffffff66',
        fadeColor: '#000000',
        accent: ACCENT,
        isDark: true,
      };
    case 'lightGradient':
      return {
        mode,
        topBarBg: '#ccc',
        sheetBg: '#bbb',
        cardBg: '#d0d0d0',
        tabNavBg: '#bbb',
        textPrimary: '#111111',
        textSecondary: '#333333',
        textMuted: '#666666',
        fadeColor: '#888888',
        accent: ACCENT,
        gradientColors: ['#cccccc', '#888888'],
        isDark: false,
      };
    case 'darkGradient':
      return {
        mode,
        topBarBg: '#444444',
        sheetBg: '#333333',
        cardBg: '#333333',
        tabNavBg: '#000000',
        textPrimary: '#ffffff',
        textSecondary: '#ffffffb3',
        textMuted: '#ffffff66',
        fadeColor: '#000000',
        accent: ACCENT,
        gradientColors: ['#444444', '#000000'],
        isDark: true,
      };
    default:
      return null; // dominant-* modes: computed from artwork, see below
  }
}

/** Simple hex-lighten/darken helper for deriving secondary surfaces from a
 *  single extracted dominant color, without pulling in a color library. */
function shade(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const r = Math.min(255, Math.max(0, (num >> 16) + amt));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amt));
  const b = Math.min(255, Math.max(0, (num & 0x0000ff) + amt));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function tokensFromDominant(mode: AppearanceMode, dominant: string): AppearanceTokens {
  const dark = mode === 'dominantDark' || mode === 'dominantVibrant';
  return {
    mode,
    topBarBg: dominant,
    sheetBg: shade(dominant, dark ? -20 : 15),
    cardBg: shade(dominant, dark ? -28 : 10),
    tabNavBg: shade(dominant, dark ? -35 : -5),
    textPrimary: dark ? '#ffffff' : '#111111',
    textSecondary: dark ? '#ffffffb3' : '#333333',
    textMuted: dark ? '#ffffff66' : '#666666',
    fadeColor: shade(dominant, dark ? -35 : -5),
    accent: ACCENT,
    isDark: dark,
  };
}

interface AppearanceContextValue {
  mode: AppearanceMode;
  setMode: (mode: AppearanceMode) => void;
  tokens: AppearanceTokens;
}

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

export function useAppearanceTokens(): AppearanceTokens {
  const ctx = useContext(AppearanceContext);
  if (!ctx) throw new Error('useAppearanceTokens must be used within AppearanceProvider');
  return ctx.tokens;
}

export function useAppearanceMode(): {mode: AppearanceMode; setMode: (mode: AppearanceMode) => void} {
  const ctx = useContext(AppearanceContext);
  if (!ctx) throw new Error('useAppearanceMode must be used within AppearanceProvider');
  return {mode: ctx.mode, setMode: ctx.setMode};
}

export function AppearanceProvider({children}: {children: React.ReactNode}): React.JSX.Element {
  const {currentTrack} = usePlaybackQueue();
  const [mode, setModeState] = useState<AppearanceMode>('default');
  const [tokens, setTokens] = useState<AppearanceTokens>(DEFAULT_TOKENS);
  const dominantCacheRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    const saved = CacheService.getLibraryItem<AppearanceMode>(STORAGE_KEY);
    if (saved) setModeState(saved);
  }, []);

  const setMode = (next: AppearanceMode) => {
    setModeState(next);
    CacheService.setLibraryItem(STORAGE_KEY, next);
  };

  useEffect(() => {
    const fixed = computeFixedTokens(mode);
    if (fixed) {
      setTokens(fixed);
      return;
    }

    // One of the four artwork-derived modes.
    const artworkUrl = currentTrack?.artworkUrl;
    const seed = currentTrack?.id ?? 'default';
    if (!artworkUrl) {
      setTokens(tokensFromDominant(mode, colorExtractor.getFallbackColorSync(seed)));
      return;
    }

    let cancelled = false;
    const cached = dominantCacheRef.current.get(artworkUrl);
    if (cached) {
      setTokens(tokensFromDominant(mode, cached));
    } else {
      setTokens(tokensFromDominant(mode, colorExtractor.getFallbackColorSync(seed)));
      colorExtractor
        .getDominantColor(artworkUrl)
        .then(dominant => {
          if (cancelled) return;
          dominantCacheRef.current.set(artworkUrl, dominant);
          setTokens(tokensFromDominant(mode, dominant));
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [mode, currentTrack?.artworkUrl, currentTrack?.id]);

  const value = useMemo(() => ({mode, setMode, tokens}), [mode, tokens]);

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}
