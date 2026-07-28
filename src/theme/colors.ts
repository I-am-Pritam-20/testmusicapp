export const Colors = {
  // Backgrounds
  bg: '#0A0A0F',
  bgCard: '#13131A',
  bgElevated: '#1C1C26',
  bgModal: '#16161F',

  // Accent — electric violet/indigo, deliberately not spotify green;
  // matches the hue already implied by gradientCard below
  // (rgba(124,77,255) = #7C4DFF)
  accent: '#7C4DFF',
  accentLight: '#9A7BFF',
  accentDark: '#5E35D0',
  accentGlow: '#7C4DFF4d',

  // Secondary accent
  secondary: '#FF4D8D',
  secondaryLight: '#FF7AAD',

  // Text
  textPrimary: '#FFFFFF',
  textSecondary: '#C0C0C0',
  textMuted: '#5A5A6E',
  textDisabled: '#3A3A4A',

  // UI
  border: '#222230',
  borderLight: '#2E2E3E',
  divider: '#1A1A24',

  // Player
  playerBg: '#0F0F18',
  playerHandle: '#3A3A4A',

  // Status
  success: '#00E5A0',
  warning: '#FFB347',
  error: '#FF4D6A',

  // Gradients (as arrays for LinearGradient)
  gradientAccent: ['#6A3DE8', '#9A7BFF'],
  gradientDark: ['#13131A', '#0A0A0F'],
  gradientPlayer: ['#1A1040', '#0A0A0F'],
  gradientCard: ['rgba(124,77,255,0.15)', 'rgba(124,77,255,0)'],
} as const;

export const Typography = {
  xs: 10,
  sm: 12,
  base: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 30,
  display: 36,

  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const Radius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
};

export const MINI_PLAYER_HEIGHT = 56;
export const TAB_BAR_HEIGHT = 68;
export const BOTTOM_INSET_EXTRA = MINI_PLAYER_HEIGHT + TAB_BAR_HEIGHT + 48;

/** Picks white or a near-black text color against an arbitrary
 *  background hex, using perceptual luminance — for surfaces whose
 *  background is dynamic (the player's dominant-color accent) rather
 *  than one of the fixed palette colors above. */
export function getContrastText(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16) || 0;
  const g = parseInt(h.substring(2, 4), 16) || 0;
  const b = parseInt(h.substring(4, 6), 16) || 0;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#0A0A0F' : '#FFFFFF';
}
