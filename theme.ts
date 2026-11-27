export type ThemeMode = 'dark' | 'light';

export interface AccentColorOption {
  id: string;
  name: string;
  value: string;
  contrastText: string;
  muted: string;
}

export const ACCENT_COLORS: AccentColorOption[] = [
  {
    id: 'crimson',
    name: 'Crimson',
    value: '#9B1D20',
    contrastText: '#ffffff',
    muted: 'rgba(155, 29, 32, 0.18)',
  },
  {
    id: 'orange',
    name: 'Signal Orange',
    value: '#EA580C',
    contrastText: '#ffffff',
    muted: 'rgba(234, 88, 12, 0.18)',
  },
  {
    id: 'amber',
    name: 'Amber',
    value: '#E5A00D',
    contrastText: '#111115',
    muted: 'rgba(229, 160, 13, 0.20)',
  },
  {
    id: 'cobalt',
    name: 'Cobalt',
    value: '#3A7BFF',
    contrastText: '#ffffff',
    muted: 'rgba(58, 123, 255, 0.18)',
  },
  {
    id: 'emerald',
    name: 'Emerald',
    value: '#2EB872',
    contrastText: '#ffffff',
    muted: 'rgba(46, 184, 114, 0.18)',
  },
  {
    id: 'graphite',
    name: 'Graphite',
    value: '#6E7681',
    contrastText: '#ffffff',
    muted: 'rgba(110, 118, 129, 0.20)',
  },
];

export function getContrastTextColor(hexColor: string): string {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) || 0;
  const g = parseInt(hex.substring(2, 4), 16) || 0;
  const b = parseInt(hex.substring(4, 6), 16) || 0;
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance > 165 ? '#111115' : '#ffffff';
}

export function hexToRgba(hexColor: string, alpha: number): string {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) || 0;
  const g = parseInt(hex.substring(2, 4), 16) || 0;
  const b = parseInt(hex.substring(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export interface ThemeColors {
  // Main background & surfaces
  background: string;
  backgroundGradientStart: string;
  backgroundGradientEnd: string;
  cardBackground: string;
  cardBackgroundLight: string;
  cardBackgroundElevated: string;

  // Accents
  primary: string;
  primaryDark: string;
  primaryMuted: string;
  primaryText: string;

  // Text colors
  text: string;
  textSecondary: string;
  textMuted: string;

  // UI colors
  border: string;
  borderLight: string;
  borderSubtle: string;
  success: string;
  warning: string;
  error: string;
  chip: string;
  badgeBackground: string;

  // Navigation dock & UI elements
  dockBackground: string;
  dockBorder: string;
  dockCloseBtn: string;
  dockCloseIcon: string;
  modalBackdrop: string;
  modalSheet: string;
  inputBackground: string;
  statusBar: 'light-content' | 'dark-content';
}

export function getThemeColors(mode: ThemeMode = 'dark', accentValue: string = '#9B1D20'): ThemeColors {
  const isDark = mode === 'dark';
  const primaryText = getContrastTextColor(accentValue);
  const primaryMuted = hexToRgba(accentValue, isDark ? 0.18 : 0.15);
  const backgroundGradientStart = hexToRgba(accentValue, isDark ? 0.16 : 0.18);
  const backgroundGradientEnd = hexToRgba(accentValue, isDark ? 0.03 : 0.04);

  if (isDark) {
    return {
      background: '#000000',
      backgroundGradientStart,
      backgroundGradientEnd,
      cardBackground: '#16161a',
      cardBackgroundLight: '#202026',
      cardBackgroundElevated: '#1a1a20',

      primary: accentValue,
      primaryDark: '#7a1719',
      primaryMuted,
      primaryText,

      text: '#ffffff',
      textSecondary: '#8a8a93',
      textMuted: '#55555c',

      border: '#24242a',
      borderLight: '#32323a',
      borderSubtle: '#1d1d23',

      success: '#30d158',
      warning: '#ffd60a',
      error: '#ff453a',
      chip: '#e5b842',
      badgeBackground: '#1d1d22',

      dockBackground: '#15151a',
      dockBorder: '#262630',
      dockCloseBtn: '#22222a',
      dockCloseIcon: '#ffffff',
      modalBackdrop: 'rgba(0, 0, 0, 0.75)',
      modalSheet: '#16161a',
      inputBackground: '#0e0e12',
      statusBar: 'light-content',
    };
  }

  // Light Mode (Nothing OS Light)
  return {
    background: '#f4f4f7',
    backgroundGradientStart,
    backgroundGradientEnd,
    cardBackground: '#ffffff',
    cardBackgroundLight: '#ebebf0',
    cardBackgroundElevated: '#f7f7fa',

    primary: accentValue,
    primaryDark: '#7a1719',
    primaryMuted,
    primaryText,

    text: '#111115',
    textSecondary: '#6e6e78',
    textMuted: '#9e9ea8',

    border: '#e4e4eb',
    borderLight: '#d2d2dc',
    borderSubtle: '#eeeeee',

    success: '#24a148',
    warning: '#d97706',
    error: '#dc2626',
    chip: '#b45309',
    badgeBackground: '#ededf2',

    dockBackground: '#ffffff',
    dockBorder: '#e0e0e8',
    dockCloseBtn: '#ebebef',
    dockCloseIcon: '#111115',
    modalBackdrop: 'rgba(0, 0, 0, 0.55)',
    modalSheet: '#ffffff',
    inputBackground: '#f2f2f6',
    statusBar: 'dark-content',
  };
}

// Default export for backwards compatibility
export const COLORS: ThemeColors = getThemeColors('dark', '#9B1D20');

export const FONTS = {
  ndot: 'Ndot57',           // For app name, numbers, amounts
  ndotCaps: 'Ndot57Caps',   // For headings and labels
  regular: 'DMSans_400Regular', // Body regular (DM Sans)
  medium: 'DMSans_500Medium',   // Subheadings, labels, buttons (DM Sans)
  bold: 'DMSans_700Bold',       // Bold labels, highlights (DM Sans)
  sans: 'DMSans_400Regular',
  sansMedium: 'DMSans_500Medium',
  sansBold: 'DMSans_700Bold',
  system: 'DMSans_400Regular',  // Default to DM Sans
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const BORDER_RADIUS = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 9999,
};

export const FONT_SIZES = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 18,
  xl: 22,
  xxl: 28,
  xxxl: 34,
};

// Use this in your components:
// import { COLORS, FONTS, SPACING, BORDER_RADIUS, FONT_SIZES } from '../../theme';