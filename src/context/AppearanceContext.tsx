/**
 * AppearanceContext — App-wide visual theme (10 modes).
 *
 * Ported from the real inotuneoffline AppearanceContext.tsx (uploaded as
 * reference) — a from-scratch prose reconstruction had been built here
 * earlier and turned out not to match; this replaces it with the actual
 * spec: computeTokens() is a pure function returning one of 10 token
 * sets, memoized so consumers only re-render on an actual mode or
 * dominant-color change, not on every render of whatever screen reads it.
 *
 * Excluded from this token system by design (per the reference):
 * MiniPlayerBar (has its own dominant-color logic already, except mode 6
 * "Colored" — see miniPlayerBg below), and the toast/alert surfaces stay
 * on their own fixed dark styling rather than following the mode.
 *
 * Two adaptations from the reference for this project:
 *  - Persistence via this app's existing MMKV-backed CacheService rather
 *    than adding AsyncStorage as a new dependency for one string.
 *  - Dominant color is pulled from PlaybackQueueContext's currentTrack
 *    (this app doesn't have a separate PlayerContext to push it in from)
 *    via the existing colorExtractor service, the same one MiniPlayerBar
 *    already uses.
 */
import React, {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState} from 'react';
import {useColorScheme, ImageBackground, StyleSheet, View, type StyleProp, type ViewStyle} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {CacheService} from '../services/CacheService';
import {colorExtractor} from '../services/colorExtractor';
import {usePlaybackQueue} from './PlaybackQueueContext';

const STORAGE_KEY = 'appearance_mode_v1';

// ─── Mode definition ────────────────────────────────────────────────────

export type AppearanceMode =
  | 'light' // 1
  | 'dark' // 2
  | 'device' // 3
  | 'lightGradient' // 4
  | 'darkGradient' // 5
  | 'colored' // 6
  | 'coloredGradient' // 7
  | 'coloredGradientDark' // 8
  | 'imageBlur' // 9
  | 'default'; // 10

// ─── Token set ──────────────────────────────────────────────────────────

export interface AppearanceTokens {
  bg: string;
  bgColors: [string, string]; // for gradient modes
  isGradient: boolean;
  isImageBlur: boolean;
  topBarBg: string;
  topBarShadow: string;
  cardBg: string;
  sheetBg: string;
  divider: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  fadeColor: string;
  tabNavBg: string;
  /** null in every mode except 6 "Colored" (darken(dominant, 0.35)) — the
   *  mini player otherwise always uses the raw dominant color directly,
   *  regardless of mode; see MiniPlayerBar.tsx. */
  miniPlayerBg: string | null;
}

function darken(hex: string, amount = 0.4): string {
  const h = hex.replace('#', '');
  const num = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  const r = Math.max(0, Math.floor(((num >> 16) & 0xff) * (1 - amount)));
  const g = Math.max(0, Math.floor(((num >> 8) & 0xff) * (1 - amount)));
  const b = Math.max(0, Math.floor((num & 0xff) * (1 - amount)));
  return `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`;
}

function computeTokens(mode: AppearanceMode, dominant: string, deviceScheme: 'light' | 'dark'): AppearanceTokens {
  const dark = deviceScheme === 'dark';

  switch (mode) {
    case 'light':
      return {
        bg: '#cccccc', bgColors: ['#cccccc', '#cccccc'], isGradient: false, isImageBlur: false,
        topBarBg: '#bbbbbb', topBarShadow: '#bbbbbb',
        cardBg: '#d8d8d8', sheetBg: '#d0d0d0', divider: '#b8b8b8', border: '#c0c0c0',
        textPrimary: '#111111', textSecondary: '#444444', textMuted: '#666666',
        fadeColor: '#cccccc', tabNavBg: '#bbbbbb', miniPlayerBg: null,
      };

    case 'dark':
      return {
        bg: '#444444', bgColors: ['#444444', '#444444'], isGradient: false, isImageBlur: false,
        topBarBg: '#333333', topBarShadow: '#333333',
        cardBg: '#3a3a3a', sheetBg: '#333333', divider: '#555555', border: '#4a4a4a',
        textPrimary: '#ffffff', textSecondary: '#cccccc', textMuted: '#888888',
        fadeColor: '#444444', tabNavBg: '#000000', miniPlayerBg: null,
      };

    case 'device':
      return computeTokens(dark ? 'dark' : 'light', dominant, deviceScheme);

    case 'lightGradient':
      return {
        bg: '#cccccc', bgColors: ['#cccccc', '#888888'], isGradient: true, isImageBlur: false,
        topBarBg: '#bbbbbb', topBarShadow: '#bbbbbb',
        cardBg: 'rgba(200,200,200,0.85)', sheetBg: '#d0d0d0', divider: '#b0b0b0', border: '#c0c0c0',
        textPrimary: '#111111', textSecondary: '#444444', textMuted: '#666666',
        fadeColor: '#888888', tabNavBg: '#bbbbbb', miniPlayerBg: null,
      };

    case 'darkGradient':
      return {
        bg: '#444444', bgColors: ['#444444', '#000000'], isGradient: true, isImageBlur: false,
        topBarBg: '#333333', topBarShadow: '#333333',
        cardBg: 'rgba(40,40,40,0.9)', sheetBg: '#333333', divider: '#555555', border: '#4a4a4a',
        textPrimary: '#ffffff', textSecondary: '#cccccc', textMuted: '#888888',
        fadeColor: '#000000', tabNavBg: '#000000', miniPlayerBg: null,
      };

    case 'colored':
      return {
        bg: dominant, bgColors: [dominant, dominant], isGradient: false, isImageBlur: false,
        topBarBg: darken(dominant, 0.2), topBarShadow: darken(dominant, 0.3),
        cardBg: darken(dominant, 0.15) + 'cc', sheetBg: darken(dominant, 0.25),
        divider: 'rgba(255,255,255,0.1)', border: 'rgba(255,255,255,0.12)',
        textPrimary: '#ffffff', textSecondary: 'rgba(255,255,255,0.75)', textMuted: 'rgba(255,255,255,0.45)',
        fadeColor: dominant, tabNavBg: '#000000',
        miniPlayerBg: darken(dominant, 0.35),
      };

    case 'coloredGradient': {
      const dark2 = darken(dominant, 0.5);
      return {
        bg: dominant, bgColors: [dominant, dark2], isGradient: true, isImageBlur: false,
        topBarBg: darken(dominant, 0.15), topBarShadow: darken(dominant, 0.3),
        cardBg: 'rgba(0,0,0,0.18)', sheetBg: darken(dominant, 0.3),
        divider: 'rgba(255,255,255,0.1)', border: 'rgba(255,255,255,0.12)',
        textPrimary: '#ffffff', textSecondary: 'rgba(255,255,255,0.75)', textMuted: 'rgba(255,255,255,0.45)',
        fadeColor: dark2, tabNavBg: '#000000', miniPlayerBg: null,
      };
    }

    case 'coloredGradientDark':
      return {
        bg: dominant, bgColors: [dominant, '#000000'], isGradient: true, isImageBlur: false,
        topBarBg: darken(dominant, 0.1), topBarShadow: '#000000',
        cardBg: darken(dominant, 0.2) + 'cc', sheetBg: darken(dominant, 0.25),
        divider: 'rgba(255,255,255,0.08)', border: 'rgba(255,255,255,0.1)',
        textPrimary: '#ffffff', textSecondary: 'rgba(255,255,255,0.7)', textMuted: 'rgba(255,255,255,0.4)',
        fadeColor: '#000000', tabNavBg: '#000000', miniPlayerBg: null,
      };

    case 'imageBlur':
      return {
        bg: '#000000', bgColors: ['#000000', '#000000'], isGradient: false, isImageBlur: true,
        topBarBg: 'rgba(0,0,0,0.55)', topBarShadow: 'transparent',
        cardBg: 'rgba(0,0,0,0.52)', sheetBg: 'rgba(8,12,10,0.88)',
        divider: 'rgba(255,255,255,0.08)', border: 'rgba(255,255,255,0.1)',
        textPrimary: '#ffffff', textSecondary: 'rgba(255,255,255,0.7)', textMuted: 'rgba(255,255,255,0.4)',
        fadeColor: '#000000', tabNavBg: '#000000', miniPlayerBg: null,
      };

    default: // 10 — Default
      return {
        bg: '#0A0A0F', bgColors: ['#0D4846', '#000000'], isGradient: true, isImageBlur: false,
        topBarBg: '#0b3f3e', topBarShadow: '#0b3f3e',
        cardBg: '#13131A', sheetBg: '#14201c',
        divider: 'rgba(255,255,255,0.06)', border: '#222230',
        textPrimary: '#ffffff', textSecondary: '#C0C0C0', textMuted: '#5A5A6E',
        fadeColor: '#000000', tabNavBg: '#000000', miniPlayerBg: null,
      };
  }
}

// ─── Context ────────────────────────────────────────────────────────────

interface AppearanceCtxValue {
  mode: AppearanceMode;
  tokens: AppearanceTokens;
  setMode: (m: AppearanceMode) => void;
  dominantColor: string;
}

const Ctx = createContext<AppearanceCtxValue | null>(null);

export function useAppearance(): AppearanceCtxValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAppearance must be used within AppearanceProvider');
  return ctx;
}

export function useAppearanceTokens(): AppearanceTokens {
  return useAppearance().tokens;
}

export function AppearanceProvider({children}: {children: React.ReactNode}): React.JSX.Element {
  const deviceScheme = (useColorScheme() ?? 'dark') as 'light' | 'dark';
  const {currentTrack} = usePlaybackQueue();
  const [mode, setModeState] = useState<AppearanceMode>('default');
  const [dominant, setDominant] = useState('#0D4846');
  const dominantCacheRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    const saved = CacheService.getLibraryItem<AppearanceMode>(STORAGE_KEY);
    if (saved) setModeState(saved);
  }, []);

  const setMode = useCallback((m: AppearanceMode) => {
    setModeState(m);
    CacheService.setLibraryItem(STORAGE_KEY, m);
  }, []);

  // Dominant-color sync — mirrors MiniPlayerBar's own extraction so a
  // colored mode and the mini player never disagree about the color.
  useEffect(() => {
    const artworkUrl = currentTrack?.artworkUrl;
    const seed = currentTrack?.id ?? 'default';
    if (!artworkUrl) {
      setDominant(colorExtractor.getFallbackColorSync(seed));
      return;
    }
    let cancelled = false;
    const cached = dominantCacheRef.current.get(artworkUrl);
    if (cached) {
      setDominant(cached);
    } else {
      setDominant(colorExtractor.getFallbackColorSync(seed));
      colorExtractor
        .getDominantColor(artworkUrl)
        .then(color => {
          if (cancelled) return;
          dominantCacheRef.current.set(artworkUrl, color);
          setDominant(color);
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [currentTrack?.artworkUrl, currentTrack?.id]);

  const tokens = useMemo(() => computeTokens(mode, dominant, deviceScheme), [mode, dominant, deviceScheme]);
  const value = useMemo(() => ({mode, tokens, setMode, dominantColor: dominant}), [mode, tokens, setMode, dominant]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// ─── AnimatedBg — drop-in background wrapper for screens ─────────────────
// "Animated" per the reference's naming — the transition itself is a
// plain re-render on mode/color change, not a Reanimated-driven color
// interpolation; the token computation above is what's memoized to keep
// that re-render as cheap and infrequent as possible.

export interface AnimatedBgProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** For imageBlur mode — omit and it falls back to a solid background. */
  artworkUri?: string | null;
}

export function AnimatedBg({children, style, artworkUri}: AnimatedBgProps): React.JSX.Element {
  const {tokens} = useAppearance();

  if (tokens.isImageBlur && artworkUri) {
    return (
      <ImageBackground source={{uri: artworkUri}} style={[styles.fill, style]} resizeMode="cover">
        <View style={styles.blurOverlay} />
        {children}
      </ImageBackground>
    );
  }
  if (tokens.isGradient) {
    return (
      <LinearGradient colors={tokens.bgColors} locations={[0, 1]} style={[styles.fill, style]}>
        {children}
      </LinearGradient>
    );
  }
  return <View style={[styles.fill, {backgroundColor: tokens.bg}, style]}>{children}</View>;
}

export function AnimatedTopBar({children, style}: {children: React.ReactNode; style?: StyleProp<ViewStyle>}): React.JSX.Element {
  const {tokens} = useAppearance();
  return <View style={[style, {backgroundColor: tokens.topBarBg}]}>{children}</View>;
}

export function AnimatedCard({children, style}: {children: React.ReactNode; style?: StyleProp<ViewStyle>}): React.JSX.Element {
  const {tokens} = useAppearance();
  return <View style={[style, {backgroundColor: tokens.cardBg}]}>{children}</View>;
}

const styles = StyleSheet.create({
  fill: {flex: 1},
  blurOverlay: {...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.55)'},
});
