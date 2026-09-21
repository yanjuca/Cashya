// Theme configuration based on mockup design

export const COLORS = {
  // Main colors
  background: '#000000',
  backgroundGradientStart: '#140708', // Subtle dark red tint
  backgroundGradientEnd: '#000000',   // Pure OLED black
  cardBackground: '#18181c',
  cardBackgroundLight: '#202026',
  primary: '#ff453a',
  primaryDark: '#d32f2f',
  primaryMuted: 'rgba(255, 69, 58, 0.15)',
  
  // Text colors
  text: '#ffffff',
  textSecondary: '#8a8a93',
  textMuted: '#55555c',
  
  // UI colors
  border: '#24242a',
  borderLight: '#32323a',
  success: '#30d158',
  warning: '#ffd60a',
  error: '#ff453a',
  chip: '#e5b842',
  badgeBackground: '#1d1d22',
};

export const FONTS = {
  ndot: 'Ndot57',           // For app name, numbers, amounts
  ndotCaps: 'Ndot57Caps',   // For headings and labels
  system: 'System',         // Fallback to system
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